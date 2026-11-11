/* IA na borda (Edge Function): o streaming pode durar o tempo que a resposta precisar.
   As Functions comuns cortam o streaming em 10 s, o que travava estudos longos e capítulos. */
import aiHandler from "../functions/ai.mjs";
export default (req) => aiHandler(req);
export const config = { path: "/api/ai" };
