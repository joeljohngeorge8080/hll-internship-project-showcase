// Bridges the frontend to Claude Sonnet on AWS Bedrock. Kept as one function
// branching on `mode` (chat vs. report) rather than two, since both share the
// same auth check and Bedrock call shape — split later only if they diverge.
//
// Required secrets (`supabase secrets set NAME=value`), never frontend env vars:
//   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, BEDROCK_MODEL_ID
//   SUPABASE_SERVICE_ROLE_KEY (for the quota table and AI data tools below)
// Optional secrets: AI_DAILY_CALL_LIMIT, AI_MONTHLY_CALL_LIMIT (default 50 / 500)
import { createClient } from 'npm:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Deliberate product decision (confirmed explicitly, not a default): every
// authenticated user gets the same assistant and the same data tools below,
// regardless of role. There is no per-role gating here by design — the
// employees/projects tables' own RLS role scoping is intentionally bypassed
// via the service-role client so the assistant can answer org-wide staff and
// financial questions for any user, not just HR/Admin.
const CHAT_SYSTEM_PROMPT =
  'You are the AI assistant embedded in HMA IEMS, an internal project/HR/finance ' +
  "management system for HMA. Answer questions about the software and the company's " +
  'work. You have tools to look up the current staff directory, project finances, and ' +
  "the caller's own employee record — use them whenever a question depends on real " +
  'data rather than answering from memory. Only state figures and facts that came back ' +
  "from a tool call. If a tool doesn't cover what's asked, or a lookup returns nothing, " +
  'say so rather than guessing.'

const REPORT_SYSTEM_PROMPT =
  'You write narrative summaries of HMA project data for internal reports. You ' +
  'will receive a JSON array of report sections, each with a title and either ' +
  'key/value facts or a table of rows. Write a clear, factual prose summary ' +
  'organized by section. Do not invent figures that are not present in the data.'

// Bedrock Converse API tool definitions. Each is backed by a Supabase query
// in runTool() below, executed with the service-role client (bypasses RLS)
// per the unrestricted-access product decision above.
const TOOLS = [
  {
    toolSpec: {
      name: 'get_own_record',
      description: "Fetch the calling user's own employee and employment record.",
      inputSchema: { json: { type: 'object', properties: {}, additionalProperties: false } },
    },
  },
  {
    toolSpec: {
      name: 'get_staff_directory',
      description:
        'List HMA staff with designation, department, status, and current salary. ' +
        'Optional search filters by first/last name or employee code.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            search: { type: 'string', description: 'Optional name or employee code filter' },
          },
          additionalProperties: false,
        },
      },
    },
  },
  {
    toolSpec: {
      name: 'get_project_finances',
      description:
        'List HMA projects with funding agency, value, amount received/sanctioned/spent/utilized. ' +
        'Optional filters by status or a project title/code search.',
      inputSchema: {
        json: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'One of: pipeline, approved, ongoing, completed',
            },
            search: { type: 'string', description: 'Project title or project code filter' },
          },
          additionalProperties: false,
        },
      },
    },
  },
]

// Each iteration is a real Bedrock call and consumes one quota unit, so a
// single chat turn that needs several lookups can cost up to this many
// units — intentional, since quota tracks actual Bedrock spend, not user
// messages.
const MAX_TOOL_ITERATIONS = 4
const RESULT_ROW_LIMIT = 200

// PostgREST's .or() takes a raw filter string it does not further escape, so
// unsanitized search input (from model-constructed tool-call arguments,
// themselves influenced by user messages) could inject extra filter clauses.
// Strip everything but a safe character set before building any filter.
function sanitizeSearch(value) {
  return String(value ?? '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .trim()
    .slice(0, 60)
}

async function runTool(name, input, serviceClient, userId) {
  if (name === 'get_own_record') {
    const { data: profile, error: profileError } = await serviceClient
      .from('profiles')
      .select('employee_id, full_name, role')
      .eq('id', userId)
      .maybeSingle()
    if (profileError) return { error: profileError.message }
    if (!profile?.employee_id) return { error: 'No employee record is linked to this account.' }

    const { data: employee, error: employeeError } = await serviceClient
      .from('employees')
      .select(
        'employee_id, first_name, middle_name, last_name, status, joined_date, current_salary, ' +
          'employee_employment(designation, department, working_region, working_state, start_date, end_date)',
      )
      .eq('id', profile.employee_id)
      .maybeSingle()
    if (employeeError) return { error: employeeError.message }
    return employee ?? { error: 'Employee record not found.' }
  }

  if (name === 'get_staff_directory') {
    let query = serviceClient
      .from('employees')
      .select(
        'employee_id, first_name, last_name, status, current_salary, employee_employment(designation, department)',
      )
      .order('last_name')
      .limit(RESULT_ROW_LIMIT)
    const search = sanitizeSearch(input?.search)
    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,employee_id.ilike.%${search}%`,
      )
    }
    const { data, error } = await query
    if (error) return { error: error.message }
    return { staff: data }
  }

  if (name === 'get_project_finances') {
    let query = serviceClient
      .from('projects')
      .select(
        'project_code, title, funding_agency, status, project_value, amount_received, ' +
          'amount_sanctioned, amount_spent, amount_utilized, start_date, end_date',
      )
      .order('start_date', { ascending: false })
      .limit(RESULT_ROW_LIMIT)
    const status = sanitizeSearch(input?.status)
    if (status) query = query.eq('status', status)
    const search = sanitizeSearch(input?.search)
    if (search) query = query.or(`title.ilike.%${search}%,project_code.ilike.%${search}%`)
    const { data, error } = await query
    if (error) return { error: error.message }
    return { projects: data }
  }

  return { error: `Unknown tool: ${name}` }
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

// Persistent daily/monthly cap, backed by ai_usage_quota (see migration
// 00000000000085). Replaces the old in-memory per-instance cooldown, which
// reset on cold start and didn't share across scaled instances.
async function checkAndIncrementQuota(serviceClient, userId) {
  const dailyLimit = Number(Deno.env.get('AI_DAILY_CALL_LIMIT') ?? 50)
  const monthlyLimit = Number(Deno.env.get('AI_MONTHLY_CALL_LIMIT') ?? 500)
  const today = new Date().toISOString().slice(0, 10)
  const monthStart = `${today.slice(0, 7)}-01`

  const { data: monthRows, error: monthError } = await serviceClient
    .from('ai_usage_quota')
    .select('usage_date, call_count')
    .eq('user_id', userId)
    .gte('usage_date', monthStart)
  if (monthError) return { ok: false, message: 'Failed to check usage quota.' }

  const monthTotal = (monthRows ?? []).reduce((sum, row) => sum + row.call_count, 0)
  if (monthTotal >= monthlyLimit) {
    return { ok: false, message: 'Monthly AI usage limit reached. Try again next month.' }
  }

  const todayRow = (monthRows ?? []).find((row) => row.usage_date === today)
  if ((todayRow?.call_count ?? 0) >= dailyLimit) {
    return { ok: false, message: 'Daily AI usage limit reached. Try again tomorrow.' }
  }

  const { error: upsertError } = await serviceClient
    .from('ai_usage_quota')
    .upsert(
      { user_id: userId, usage_date: today, call_count: (todayRow?.call_count ?? 0) + 1 },
      { onConflict: 'user_id,usage_date' },
    )
  if (upsertError) return { ok: false, message: 'Failed to record usage quota.' }

  return { ok: true }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_ANON_KEY'),
    { global: { headers: { Authorization: authHeader } } },
  )

  const {
    data: { user },
    error: authError,
  } = await supabaseClient.auth.getUser()
  if (authError || !user) {
    return jsonResponse({ error: 'Unauthorized' }, 401)
  }

  // Service-role client: used for the quota table and for the AI data
  // tools, which intentionally bypass employees/projects RLS so the
  // assistant can answer org-wide questions for any authenticated user.
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
  )

  let body
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { mode } = body
  const region = Deno.env.get('AWS_REGION')
  const modelId = Deno.env.get('BEDROCK_MODEL_ID')
  const aws = new AwsClient({
    accessKeyId: Deno.env.get('AWS_ACCESS_KEY_ID'),
    secretAccessKey: Deno.env.get('AWS_SECRET_ACCESS_KEY'),
    service: 'bedrock',
    region,
  })
  const bedrockUrl = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`

  async function callBedrock(bedrockMessages, systemPrompt, toolConfig) {
    const quota = await checkAndIncrementQuota(serviceClient, user.id)
    if (!quota.ok) return { ok: false, status: 429, error: quota.message }

    let bedrockRes
    try {
      bedrockRes = await aws.fetch(bedrockUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: bedrockMessages,
          system: [{ text: systemPrompt }],
          inferenceConfig: { maxTokens: 2048, temperature: 0.4 },
          ...(toolConfig ? { toolConfig } : {}),
        }),
      })
    } catch (err) {
      console.error('Bedrock request failed', err)
      return { ok: false, status: 502, error: 'Failed to reach Bedrock' }
    }

    if (!bedrockRes.ok) {
      const errText = await bedrockRes.text().catch(() => '')
      console.error('Bedrock error', bedrockRes.status, errText)
      return { ok: false, status: 502, error: 'Bedrock request failed' }
    }

    return { ok: true, data: await bedrockRes.json() }
  }

  if (mode === 'chat') {
    if (!Array.isArray(body.messages) || !body.messages.length) {
      return jsonResponse({ error: 'messages array is required' }, 400)
    }

    const conversation = body.messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: [{ text: String(m.content ?? '') }],
    }))

    let finalText = ''
    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const result = await callBedrock(conversation, CHAT_SYSTEM_PROMPT, { tools: TOOLS })
      if (!result.ok) return jsonResponse({ error: result.error }, result.status)

      const message = result.data?.output?.message
      const stopReason = result.data?.stopReason

      if (stopReason === 'tool_use' && message) {
        conversation.push(message)
        const toolUseBlocks = (message.content ?? []).filter((c) => c.toolUse)
        const toolResultContent = []
        for (const block of toolUseBlocks) {
          const toolOutput = await runTool(block.toolUse.name, block.toolUse.input, serviceClient, user.id)
          toolResultContent.push({
            toolResult: {
              toolUseId: block.toolUse.toolUseId,
              content: [{ json: toolOutput }],
            },
          })
        }
        conversation.push({ role: 'user', content: toolResultContent })
        continue
      }

      finalText = (message?.content ?? []).map((c) => c.text ?? '').join('')
      break
    }

    if (!finalText) {
      finalText = 'I needed more lookups than I could fit in one response — could you narrow the question?'
    }
    return jsonResponse({ reply: finalText })
  }

  if (mode === 'report') {
    if (!Array.isArray(body.sections)) {
      return jsonResponse({ error: 'sections array is required' }, 400)
    }
    const bedrockMessages = [{ role: 'user', content: [{ text: JSON.stringify(body.sections) }] }]
    const result = await callBedrock(bedrockMessages, REPORT_SYSTEM_PROMPT)
    if (!result.ok) return jsonResponse({ error: result.error }, result.status)

    const text =
      result.data?.output?.message?.content?.map((c) => c.text ?? '').join('') ?? ''
    return jsonResponse({ narrative: text })
  }

  return jsonResponse({ error: 'mode must be "chat" or "report"' }, 400)
})
