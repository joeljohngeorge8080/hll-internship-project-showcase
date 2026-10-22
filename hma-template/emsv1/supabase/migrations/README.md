# Migration numbering

Each file's leading number (`00000000000038_...`) is its version and doubles
as the primary key in Supabase's remote `schema_migrations` tracking table —
two files can't share the same number. `00000000000026_installment_uc_fields.sql`
collided with the already-applied `00000000000026_hr_activity_receivables.sql`
this way and silently never got pushed until it was caught and renumbered to
`00000000000039`. Before adding a new migration, check the highest existing
number in this folder rather than reusing one from memory.
