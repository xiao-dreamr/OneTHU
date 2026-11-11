/**
 * R1 回归：登录页响应只能恢复会话，写请求不得自动重放；GET 仍可安全重放。
 * 运行：node --experimental-strip-types test/http-replay.smoke.mjs
 */
import { HttpClient, ReplaySuppressedError } from "../src/http.ts";

const LOGIN_HTML = '<html><body><input id="sm2publicKey"><input name="i_pass"></body></html>';
let pass = 0;
const ok = (cond, label) => { console.log(cond ? "PASS" : "FAIL", label); if (cond) pass++; };

/* POST：第一次登录页 → 重登一次，但请求次数必须保持 1，并抛 ReplaySuppressed。 */
{
  let calls = 0;
  let relogins = 0;
  const client = new HttpClient({
    fetch: async () => {
      calls += 1;
      return new Response(LOGIN_HTML, { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  client.onAuthRequired(async () => { relogins += 1; });
  let code = "";
  try {
    await client.postForm("https://learn.tsinghua.edu.cn/b/wlxt/kczy/zy/student/tjzy", new URLSearchParams({ x: "1" }));
  } catch (e) {
    code = e instanceof ReplaySuppressedError ? e.code : String(e);
  }
  ok(calls === 1, `POST 不重放（calls=${calls}）`);
  ok(relogins === 1, `POST 仍恢复会话（relogins=${relogins}）`);
  ok(code === "AUTH_REPLAY_SUPPRESSED", `POST 抛出可识别错误（${code}）`);
}

/* GET：登录页 → 重登后允许再发一次。 */
{
  let calls = 0;
  let relogins = 0;
  const client = new HttpClient({
    fetch: async () => {
      calls += 1;
      return new Response(calls === 1 ? LOGIN_HTML : "ok", { status: 200, headers: { "content-type": "text/html" } });
    },
  });
  client.onAuthRequired(async () => { relogins += 1; });
  const body = await client.text("https://learn.tsinghua.edu.cn/f/wlxt/index/course/student/index");
  ok(calls === 2, `GET 重放一次（calls=${calls}）`);
  ok(relogins === 1 && body === "ok", "GET 重放后返回新响应");
}

console.log(`http-replay: ${pass}/5`);
process.exit(pass === 5 ? 0 : 1);
