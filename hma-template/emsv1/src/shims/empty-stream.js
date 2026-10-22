// xlsx-js-style optionally wires up Node's stream.Readable if `require('stream')`
// succeeds. In the browser it never does anything useful with it (we only ever
// export to an ArrayBuffer/Blob), but Vite's externalized-module proxy logs a
// console warning the moment the library touches `.Readable` on import. This
// aliases 'stream' to a plain empty module so that property read is silent.
export default {}
