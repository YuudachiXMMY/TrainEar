"use strict";
/* 服务端 API 客户端。file:// 直接打开时进入离线模式，应用照常可用（仅本地存储）。 */
const API = {
  user: null,
  offline: location.protocol === "file:",

  async _req(method, url, body, isForm){
    if(this.offline) return { error: "离线模式" };
    const opt = { method, credentials: "same-origin", headers: {} };
    if(body && !isForm){ opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
    if(body && isForm){ opt.body = body; }
    let r;
    try{ r = await fetch(url, opt); }
    catch(e){ return { error: "连不上服务器" }; }
    let j = {};
    try{ j = await r.json(); }catch(e){}
    if(!r.ok && !j.error) j.error = "请求失败（" + r.status + "）";
    return j;
  },

  me(){ return this._req("GET", "/api/auth/me"); },
  register(username, email, password){ return this._req("POST", "/api/auth/register", { username, email, password }); },
  verify(email, code){ return this._req("POST", "/api/auth/verify", { email, code }); },
  login(account, password){ return this._req("POST", "/api/auth/login", { account, password }); },
  requestCode(email, purpose){ return this._req("POST", "/api/auth/request-code", { email, purpose }); },
  loginCode(email, code){ return this._req("POST", "/api/auth/login-code", { email, code }); },
  logout(){ return this._req("POST", "/api/auth/logout"); },

  getProgress(){ return this._req("GET", "/api/progress"); },
  putProgress(data){ return this._req("PUT", "/api/progress", { data }); },

  listSamples(){ return this._req("GET", "/api/samples"); },
  uploadSample(formData){ return this._req("POST", "/api/samples", formData, true); },
  deleteSample(id){ return this._req("DELETE", "/api/samples/" + id); }
};
