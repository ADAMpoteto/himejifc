/* =====================================================================
   姫路FC ― 公式サイト（姫路市社会人サッカーリーグ）
   データはGoogleスプレッドシートから読み込みます。

   ■ つなぎ方（どちらか1つ）
     A. スプシを「共有 → リンクを知っている全員（閲覧者）」にする
        → SHEET_ID にスプシのID（URLの /d/ と /edit の間）を入れるだけ（入れてあります）
     B. スプシを「ファイル → 共有 → ウェブに公開（ドキュメント全体）」する
        → 公開したときのURLを PUB_URL に貼る（こちらのほうが読み込みが安定します）

   ■ 画像（GitHubの images フォルダに、名前と同じファイル名で置くだけ）
     選手の写真   : images/player/内海 友彰.png   （.webp / .jpg でもOK。スペースなしでもOK）
     クラブのロゴ : images/logo/香寺SC.png           （試合シートの「相手」と同じ名前）
     自分のクラブ : emblem.png（一番上に置く）
     画像がない選手・クラブは、頭文字で表示します。
   ===================================================================== */
const SHEET_ID = "1wta1TuIpooEgHm5b3zjrCAZeq6hxFIC8fIxcj_B-Z4s";
const PUB_URL  = "";   // 例："https://docs.google.com/spreadsheets/d/e/2PACX-…/pubhtml"

const SHEETS = {   // [シート名, gid]
  match:  ["試合",         0],
  lineup: ["出場選手",     108],
  events: ["試合経過",     109],
  player: ["選手・スタッフ", 102],
  season: ["シーズン",     104],
  table:  ["順位表",       105],
  conf:   ["設定",         106],
  spon:   ["スポンサー",   120],
  hist:   ["沿革",         122],
  trans:  ["加入・退団",   123],
  notice: ["お知らせ",     124],
  past:   ["過去の試合",   125],
  posts:  ["SNS投稿",      126],
  teams:  ["チーム",       127]
};
const DEFAULT_CLUB = "姫路FC";
const HALF = 35;   /* 前半の時間（分）。姫路市2部リーグは35分ハーフ */
const IMG_EXT = ["jpg", "png", "webp", "jpeg"];
/* 相手エンブレムのファイル名（英数字）。日本語のファイル名はzip解凍で文字化けすることがあるため */
const LOGO_FILE = {
  "FCヴィエンティス白鳥":"vientis", "FCVOLTS":"volts", "TOPBOY":"topboy", "香寺SC":"kohdera",
  "FCリザーブ":"reserve", "FCWINDS":"winds", "MEGERE":"megere", "エアリアル":"airial",
  "グリーンキャッツ":"greencats", "エンヤサール灘FC":"enyasal"
};

/* ---------- 小物 ---------- */
const $ = id => document.getElementById(id);
const esc = s => String(s==null?"":s).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const half = s => String(s==null?"":s).replace(/[０-９．－，＋％]/g, c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0));
const F = (o,k) => (o && o[k]!=null) ? String(o[k]).trim() : "";
function num(s){ const t=half(s).replace(/[,\s人万円€%]/g,""); if(t==="") return null; const n=Number(t); return isFinite(n)?n:null; }
function pct(s){ const t=half(s).trim(); const n=num(t); if(n==null) return null; return (!/%/.test(t) && n>0 && n<=1 && /\./.test(t)) ? Math.round(n*1000)/10 : n; }
function pDate(s){ const m=half(s).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/); return m?new Date(+m[1],+m[2]-1,+m[3]):null; }
const WD=["日","月","火","水","木","金","土"], WDE=["SUN","MON","TUE","WED","THU","FRI","SAT"];
const fmtD = d => d ? `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")}` : "";
const fmtDW = d => d ? `${fmtD(d)}（${WD[d.getDay()]}）` : "";
const fmtMD = d => d ? `${d.getMonth()+1}/${d.getDate()}` : "";
const dKey = d => d ? fmtD(d) : "";
const nf = n => Number(n||0).toLocaleString("ja-JP");
const nameKey = s => String(s||"").replace(/[\s　・.]/g,"").toLowerCase();
const surname = s => String(s||"").trim().split(/[\s　]+/)[0];
const empty = msg => `<div class="empty">${esc(msg)}</div>`;
const same = (a,b) => nameKey(a)===nameKey(b);
const sum = (L,f) => L.reduce((a,x)=>a+(f(x)||0),0);

function cleanRows(rows){
  return (rows||[]).map(o=>{ const n={}; Object.keys(o).forEach(k=>{ n[String(k).replace(/^﻿/,"").replace(/\s+/g,"").trim()]=o[k]; }); return n; })
    .filter(o=>Object.values(o).some(v=>String(v==null?"":v).trim()!==""));
}
/* ?demo を付けて開くと、スプシではなく demo/ フォルダのダミーデータで表示（確認用） */
const DEMO = /[?&]demo\b/.test(location.search);
function sheetUrl(key){
  if(DEMO) return `demo/${key}.csv?${Date.now()}`;
  const [name, gid] = SHEETS[key];
  const m = String(PUB_URL).match(/\/d\/e\/([^/]+)\/pub/);
  if(m) return `https://docs.google.com/spreadsheets/d/e/${m[1]}/pub?gid=${gid}&single=true&output=csv`;
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&headers=1&sheet=${encodeURIComponent(name)}`;
}
function fetchCSV(url){
  return new Promise((resolve,reject)=>{
    if(typeof Papa==="undefined"){ reject(new Error("PapaParse 未読み込み")); return; }
    Papa.parse(url, { download:true, header:true, skipEmptyLines:"greedy", complete:r=>{ const rows=cleanRows(r.data); rows.fields=(r.meta&&r.meta.fields||[]).map(k=>String(k).replace(/^\uFEFF/,"").replace(/\s+/g,"").trim()); resolve(rows); }, error:reject });
  });
}

/* ---------- 画像（名前→ファイル。見つからなければ次の候補、最後は頭文字） ---------- */
const IMG_OK = {};
function imgCands(dir, names){
  const out=[]; names.filter(Boolean).forEach(n=>{
    [...new Set([String(n).trim(), String(n).replace(/[\s　]/g,"")])].forEach(b=>IMG_EXT.forEach(e=>out.push(`images/${dir}/${b}.${e}`)));
  });
  return [...new Set(out)];
}
function initials(name){
  const s=String(name||"").trim(); if(!s) return "?";
  if(/^[\x00-\x7F\s]+$/.test(s)){ const w=s.split(/\s+/).filter(Boolean); return (w.length>1? w[0][0]+w[1][0] : s.slice(0,2)).toUpperCase(); }
  return surname(s).slice(0,2);
}
function imgTag(cands, alt, cls, key){
  const list=IMG_OK[key] ? [IMG_OK[key]] : cands;
  return `<img class="${cls}" src="${esc(encodeURI(list[0]))}" alt="${esc(alt)}" loading="lazy" decoding="async"
    data-k="${esc(key)}" data-c="${esc(list.slice(1).join("|"))}" data-i="${esc(initials(alt))}" onload="imgOk(this)" onerror="imgNext(this)">`;
}
window.imgOk = el => { const k=el.dataset.k; if(k && !IMG_OK[k]) IMG_OK[k]=decodeURI(el.getAttribute("src")); };
window.imgNext = el => {
  const rest=(el.dataset.c||"").split("|").filter(Boolean);
  if(rest.length){ el.dataset.c=rest.slice(1).join("|"); el.src=encodeURI(rest[0]); return; }
  const d=document.createElement("div"); d.className=el.className+" ph"; d.textContent=el.dataset.i||"?"; d.setAttribute("aria-label", el.alt||"");
  el.replaceWith(d);
};
function face(name, cls){
  const n=fullName(name), p=D.players.find(x=>same(x.name,n)), ph=p&&p.photo ? String(p.photo).trim() : "";
  /* 写真の欄にファイル名（拡張子つきでも、なしでも）を書けばそれを使う */
  const byId = p&&p.id ? imgCands("player",[p.id]) : [];
  const c = (ph ? (/\.(png|webp|jpe?g|gif)$/i.test(ph) ? [`images/player/${ph}`] : imgCands("player",[ph])) : []).concat(byId, imgCands("player",[n]));
  return imgTag(c, n, "face "+(cls||""), "p:"+nameKey(n));
}
const oppFace = (name, cls) => imgTag([], name, "face "+(cls||""), "o:"+nameKey(name));
function teamLogoCands(club){
  const t=teamOf(club), f=t&&t.logo ? t.logo.trim() : "";
  const first = !f ? [] : /^https?:\/\//.test(f) ? [f] : /\.(png|jpe?g|webp|svg|gif)$/i.test(f) ? [`images/logo/${f}`] : imgCands("logo",[f]);
  return [...first, ...imgCands("logo",[LOGO_FILE[club], t&&t.name, club])];
}
function logo(club, cls){
  const me=isMe(club);
  const names= me ? [clubName(), DEFAULT_CLUB] : [club];
  /* 自分のクラブ：一番上の emblem.png → images/logo/クラブ名.png の順に探す */
  const cands = me ? ["emblem.png", ...imgCands("logo",names), ...imgCands("",names).map(x=>x.replace(/^images\/\//,""))] : teamLogoCands(club);
  return imgTag(cands, me?clubName():club, "logo "+(cls||""), "l:"+(me?"__me":teamKey(club)));
}

/* =====================================================================
   データ
   ===================================================================== */
const D = { teams:[], past:[], posts:[], notices:[], hist:[], sponsors:[], srec:[], matches:[], played:[], stats:[], players:[], trans:[], seasons:[], table:[], lineups:[], conf:{}, seasonList:[], news:[], loaded:false, err:"" };
const ST = { pSeason:null, luGrp:"概要", season:null, stSeason:"", trSeason:"", comp:"すべて", newsCat:"すべて", rk:"g", tblSeason:null, tblComp:null, mtab:"sum", luSide:"me" };

const clubName = () => D.conf["クラブ名"] || DEFAULT_CLUB;
const clubEn = () => String(D.conf["英語名"] || "HIMEJI FC").toUpperCase();
const unit = () => D.conf["通貨の単位"] || "";
function isMe(club){
  const k=nameKey(club); if(!k) return false;
  return k===nameKey(clubName()) || k===nameKey(D.conf["略称"]) || k===nameKey(DEFAULT_CLUB) || /自分/.test(club);
}
const NAME_CACHE = {};
function fullName(n){
  const s=String(n||"").trim(); if(!s) return s;
  if(NAME_CACHE[s]) return NAME_CACHE[s];
  const k=nameKey(s);
  const pool=[...D.players.map(p=>p.name), ...D.stats.map(r=>r.name), ...D.lineups.filter(l=>l.side==="me").map(l=>l.rawName)];
  let hit=pool.find(p=>nameKey(p)===k);
  if(!hit){ const c=[...new Set(pool.filter(p=>nameKey(surname(p))===k).map(p=>String(p).trim()))]; if(c.length===1) hit=c[0]; }
  return NAME_CACHE[s]=hit||s;
}
function parseNames(s){
  return String(s||"").split(/[、,，\n／\/]/).map(t=>t.trim()).filter(Boolean).map(t=>{
    const m=half(t).match(/^(.*?)[\s　]*[（(×xX]?\s*(\d+)\s*[)）点]?$/);
    if(m && m[1].trim()) return { name:fullName(m[1].trim()), n:+m[2] };
    return { name:fullName(t), n:1 };
  });
}
function parsePK(s){
  const t=half(s).trim(); if(!t) return null;
  let m=t.match(/^(\d{1,2})\s*[-ー:：]\s*(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^\d{4}\D(\d{1,2})\D(\d{1,2})/); if(m) return {a:+m[1], b:+m[2]};
  m=t.match(/^(\d{1,2})\/(\d{1,2})$/); if(m) return {a:+m[1], b:+m[2]};
  return null;
}
/* フォーメーション：「4-3-3」。日付に変わってしまったもの（2026/04/03）にも対応 */
function parseForm(s){
  const t=half(s).trim(); if(!t) return "";
  if(/^\d(\s*[-ー]\s*\d){1,4}$/.test(t)) return t.replace(/\s*[-ー]\s*/g,"-");
  const m=t.match(/^\d{4}\D(\d{1,2})\D(\d{1,2})$/); if(m) return `${+m[1]}-${+m[2]}`;
  return t;
}
const sideOf = s => /相手|opp|away/i.test(s) ? "opp" : "me";
const minN = s => { const m=half(s).match(/(\d+)(?:\s*\+\s*(\d+))?/); return m ? +m[1] + (m[2]? +m[2]/100 : 0) : 999; };
const POS_DEPTH = {GK:0,CB:1,LB:1.1,RB:1.1,SW:.9,LWB:1.6,RWB:1.6,CDM:2,DM:2,CM:2.5,LM:2.6,RM:2.6,CAM:3,AM:3,LW:3.4,RW:3.4,LF:3.6,RF:3.6,CF:3.7,ST:4,FW:4,MF:2.5,DF:1};
const POS_LAT = p => /^(LB|LWB|LM|LW|LF)$/.test(p)?0 : /^(RB|RWB|RM|RW|RF)$/.test(p)?2 : 1;
const posGroup = p => { const x=String(p||"").toUpperCase().trim();
  if(/^GK/.test(x)) return "GK"; if(/^(CB|LB|RB|LWB|RWB|SW|DF)/.test(x)) return "DF";
  if(/^(CDM|CM|CAM|LM|RM|DM|AM|MF)/.test(x)) return "MF"; if(/^(LW|RW|CF|ST|LF|RF|FW)/.test(x)) return "FW"; return "OT"; };
const GROUPS = [["GK","GOALKEEPER","ゴールキーパー"],["DF","DEFENDER","ディフェンダー"],["MF","MIDFIELDER","ミッドフィルダー"],["FW","FORWARD","フォワード"],["OT","MEMBERS","メンバー"]];

/* ---------- 選手・チームの記録の項目（スプシの列名＝ここの名前） ---------- */
const P_NUM = ["出場時間", "評価", "得点", "アシスト", "シュート", "パス", "ドリブル", "タックル", "オフサイド", "ファウル", "ボール奪取", "ボールロスト", "走行距離", "スプリント距離", "ボール保持率", "ドリブル成功", "ドリブル距離", "タックルされた回数", "獲得CK", "被ファウル", "獲得PK", "ダミーからのアシスト", "通常ドリブル率", "シールドドリブル率", "ストレイフドリブル率", "アジャイルドリブル率", "ドリブルでFWライン突破（間）試み", "ドリブルでFWライン突破（間）成功", "ドリブルでFWライン突破（外）試み", "ドリブルでFWライン突破（外）成功", "ドリブルでMFライン突破（間）試み", "ドリブルでMFライン突破（間）成功", "ドリブルでMFライン突破（外）試み", "ドリブルでMFライン突破（外）成功", "ドリブルでDFライン突破（間）試み", "ドリブルでDFライン突破（間）成功", "ドリブルでDFライン突破（外）試み", "ドリブルでDFライン突破（外）成功", "抜き去り", "スキルムーブで抜き去り", "股抜き", "縦への突破", "PKを除くゴール", "PKを除くゴール期待値", "枠内シュート", "枠外シュート", "ブロックされたシュート", "FKゴール", "PKゴール", "PK戦ゴール", "シュートからのアシスト", "通常シュート", "フィネスシュート", "ヘディングシュート", "パワーシュート", "ボレーシュート", "チップシュート", "セットプレーのシュート", "期待アシスト", "セカンドアシスト", "キーパス", "パスで抜いた人数", "パス成功", "パスカットされた", "オフサイドのパス", "クロス", "クロス成功", "ブロックされたクロス", "プレッシャー下のパス", "プレッシャー下のパス成功", "グラウンダーパス", "ロブパス", "スルーパス", "ロブスルーパス", "セットプレーのパス", "パスでFWライン突破（間）試み", "パスでFWライン突破（間）成功", "パスでFWライン突破（外）試み", "パスでFWライン突破（外）成功", "パスでFWライン突破（上）試み", "パスでFWライン突破（上）成功", "パスでMFライン突破（間）試み", "パスでMFライン突破（間）成功", "パスでMFライン突破（外）試み", "パスでMFライン突破（外）成功", "パスでMFライン突破（上）試み", "パスでMFライン突破（上）成功", "パスでDFライン突破（間）試み", "パスでDFライン突破（間）成功", "スタンディングタックル", "スタンディングタックル成功", "スライディングタックル", "スライディングタックル成功", "インターセプト", "ブロック", "クリア", "オフサイド誘発", "オフェンスデュエル", "オフェンスデュエル勝利", "ディフェンスデュエル", "ディフェンスデュエル勝利", "空中戦", "空中戦勝利", "突破された回数", "守備エリアで突破された回数", "ボックス内で突破された回数", "PK献上", "オウンゴール", "警告", "退場", "被シュート", "被枠内シュート", "セーブ", "失点", "パンチング", "飛び出してのセーブ", "PKセーブ", "PK失点", "PK戦セーブ", "PK戦失点", "通常シュートをセーブ", "フィネスシュートをセーブ", "ヘディングをセーブ", "パワーシュートをセーブ", "ボレーをセーブ", "チップをセーブ", "セットプレーをセーブ"];
const T_NUM = ["ボール支配率", "ボール奪取時間", "シュート", "ゴール期待値", "パス", "タックル", "タックル成功", "インターセプト", "セーブ", "ファウル", "オフサイド", "コーナーキック", "フリーキック", "PK", "警告", "退場", "守備ライン突破（間）", "守備ライン突破（外）", "守備ライン突破（上）", "守備ライン突破の試み", "枠内シュート", "枠外シュート", "ブロックされたシュート", "通常シュート", "フィネスシュート", "ヘディングシュート", "パワーシュート", "ボレーシュート", "チップシュート", "セットプレーのシュート", "ボックス内シュート", "ボックス外シュート", "ニアサイドへのシュート", "ファーサイドへのシュート", "パス成功", "パスカットされた", "オフサイドのパス", "その他のパス", "グラウンダーパス", "ロブパス", "スルーパス", "ロブスルーパス", "クロス", "セットプレーのパス", "キーパス", "ダイレクトパス", "パス&ゴー", "サイドを使ったパス", "ブレイクアウェイのパス", "スタンディングタックル", "スタンディングタックル成功", "スライディングタックル", "スライディングタックル成功", "ブロック", "クリア", "オフェンスデュエル勝利", "ディフェンスデュエル勝利", "空中戦勝利", "突破された回数", "PK献上"];
const MAX_KEYS = {};                              /* 合計ではなく最大値を取る項目 */
const AVG_KEYS = {"評価":1,"ボール保持率":1,"通常ドリブル率":1,"シールドドリブル率":1,"ストレイフドリブル率":1,"アジャイルドリブル率":1};  /* 平均を取る項目 */
const PCT_KEYS = {"ボール支配率":1};               /* %の項目（0.56 のような入力も56に直す） */
const rate = (a,b) => (a!=null && b) ? a/b*100 : null;

async function loadAll(){
  if(DEMO && !document.querySelector(".demo-bar")) document.body.insertAdjacentHTML("afterbegin",`<div class="demo-bar">ダミーデータで表示中（確認用）<a href="${location.pathname}">本番の表示に戻る</a></div>`);
  const keys=Object.keys(SHEETS);
  const res=await Promise.allSettled(keys.map(k=>fetchCSV(sheetUrl(k))));
  const got={}; let fails=0; D.cols={};
  keys.forEach((k,i)=>{ if(res[i].status==="fulfilled"){ got[k]=res[i].value; D.cols[k]=res[i].value.fields||[]; } else { got[k]=[]; fails++; console.error(SHEETS[k][0], res[i].reason); } });
  ["trans","tstats","notice","past","posts","teams"].forEach(k=>{ if(!got[k]) got[k]=[]; });
  const isEx = o => Object.values(o).some(v=>/^[（(]例[）)]/.test(String(v||"").trim()));   /* 「（例）」の行はサイトに出さない */
  if(fails===keys.length){ D.err="データを読み込めませんでした。時間をおいてもう一度開いてください。"; console.error("スプレッドシートを読み込めません。共有設定（リンクを知っている全員が閲覧可）か PUB_URL を確認してください。"); }

  got.conf.forEach(o=>{ const k=F(o,"項目"), v=F(o,"値"); if(k) D.conf[k]=v; });
  /* チーム（ロゴ・別名） */
  D.teams=(got.teams||[]).map(o=>{ const vals=Object.keys(o); const name=F(o,"チーム名"); if(!name) return null;
    const logoK=vals.find(k=>/^ロゴ/.test(k)), aliasK=vals.find(k=>/^別名/.test(k));
    return { name, logo:logoK?F(o,logoK):"", alias:(aliasK?F(o,aliasK):"").split(/[、,，\n]/).map(x=>x.trim()).filter(Boolean) }; }).filter(Boolean);
  /* スポンサー（区分：プラン／パートナー） */
  D.sponsors=(got.spon||[]).map(o=>({ kind:F(o,"区分"), name:F(o,"名前"), price:F(o,"金額"), body:F(o,"内容"), url:F(o,"URL"), logo:F(o,"ロゴ") }))
    .filter(x=>x.name && /^(プラン|パートナー|スポンサー)$/.test(x.kind));
  D.players=got.player.map(o=>({ name:F(o,"名前"), pos:F(o,"ポジション").toUpperCase(), nat:F(o,"出身")||F(o,"国籍"), no:num(F(o,"背番号")), birth:pDate(F(o,"生年月日")), birthS:F(o,"生年月日"),
    foot:F(o,"利き足"), height:num(F(o,"身長")), memo:F(o,"メモ"), photo:F(o,"写真"), prev:F(o,"前所属"), joinY:half(F(o,"加入年")).replace(/[^0-9]/g,"").slice(0,4),
    roles:F(o,"役職").split(/[・、,，\/／\s]+/).map(x=>x.trim()).filter(Boolean),
    kana:F(o,"フリガナ"), en:F(o,"英語名"), id:F(o,"ID").toLowerCase().replace(/[^a-z0-9-]/g,""),
    first:{ app:F(o,"初出場"), goal:F(o,"初得点"), ast:F(o,"初アシスト") } })).filter(p=>p.name);
  /* 出場選手（名前合わせに使うので先に） */
  D.lineups=got.lineup.map((o,i)=>{ const side=sideOf(F(o,"チーム")); const raw=F(o,"名前");
    const s={}; P_NUM.forEach(h=>{ const v=num(F(o,h)); if(v!=null) s[h]=v; });
    return { i, key:dKey(pDate(F(o,"日付"))), side, role:F(o,"出場")||"先発", no:num(F(o,"背番号")), rawName:raw, pos:F(o,"ポジション").toUpperCase(), s,
      min:s["出場時間"]??null, g:s["得点"]||0, a:s["アシスト"]||0, yc:s["警告"]||0, rc:s["退場"]||0 }; }).filter(l=>l.rawName && l.key);
  D.lineups.forEach(l=>l.name = l.side==="me" ? fullName(l.rawName) : l.rawName);

  /* 試合（得点・失点が空欄なら「これからの試合」） */
  D.matches=got.match.map((o,i)=>{
    const gf=num(F(o,"得点")), ga=num(F(o,"失点")), opp=F(o,"相手");
    if(!opp) return null;
    const played = gf!=null && ga!=null;
    const pk=parsePK(F(o,"PK"));
    const res = !played ? "U" : gf>ga?"W" : gf<ga?"L" : pk ? (pk.a>pk.b?"W":"L") : "D";
    let ha=F(o,"H/A").toUpperCase(); ha = /^A/.test(ha)?"A" : /^N/.test(ha)?"N" : "H";
    const date=pDate(F(o,"日付"));
    return { i, season:F(o,"シーズン"), date, key:dKey(date), comp:F(o,"大会")||"試合", round:F(o,"節・回戦"), ha, opp, gf, ga, pk, res, played,
      draw: played && gf===ga, scorers:parseNames(F(o,"得点者")), assists:parseNames(F(o,"アシスト")), mom:fullName(F(o,"MOM")),
      att:num(F(o,"観客数")), venue:F(o,"会場"), memo:F(o,"メモ"), report:F(o,"レポート"), cCoach:F(o,"監督コメント"), cPlayers:F(o,"選手コメント"), time:(half(F(o,"キックオフ")||F(o,"メモ")).match(/(\d{1,2}:\d{2})/)||[])[1]||"", ts:{}, form:{}, lu:{me:[],opp:[]}, ev:[] };
  }).filter(Boolean);
  D.matches.sort((a,b)=>(a.date&&b.date? a.date-b.date : 0) || a.i-b.i);
  D.matches.forEach((m,k)=>m.id=k+1);
  const byKey={}; D.matches.forEach(m=>{ if(m.key && !byKey[m.key]) byKey[m.key]=m; });

  /* チームスタッツ */
  (got.tstats||[]).forEach(o=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return; const side=sideOf(F(o,"チーム"));
    const t={}; T_NUM.forEach(h=>{ const v= PCT_KEYS[h] ? pct(F(o,h)) : num(F(o,h)); if(v!=null) t[h]=v; });
    m.ts[side]=t; m.form[side]=parseForm(F(o,"フォーメーション")); });
  /* 出場選手を試合につなぐ */
  D.lineups.forEach(l=>{ const m=byKey[l.key]; if(m){ l.m=m; m.lu[l.side].push(l); } });
  /* 試合経過 */
  got.events.forEach((o,i)=>{ const m=byKey[dKey(pDate(F(o,"日付")))]; if(!m) return; const side=sideOf(F(o,"チーム"));
    const nm = s => side==="me" ? fullName(s) : s;
    m.ev.push({ i, min:half(F(o,"分")), mn:minN(F(o,"分")), side, kind:F(o,"種類")||"その他", player:nm(F(o,"選手")), rel:nm(F(o,"関連する選手")),
      note:F(o,"補足") }); });
  D.matches.forEach(m=>{
    m.ev.forEach(e=>{ if(e.note==="ハーフタイム") e.mn=HALF+0.5; });
    m.ev.sort((a,b)=>a.mn-b.mn || a.i-b.i);
    if(!m.played) return;
    /* 得点者・アシストが空欄なら、出場選手 → 試合経過 の順で補う */
    if(!m.scorers.length){
      const L=m.lu.me.filter(l=>l.g); if(L.length) m.scorers=L.map(l=>({name:l.name,n:l.g}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&isGoal(e)&&e.player).forEach(e=>c[e.player]=(c[e.player]||0)+1); m.scorers=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
    if(!m.assists.length){
      const L=m.lu.me.filter(l=>l.a); if(L.length) m.assists=L.map(l=>({name:l.name,n:l.a}));
      else { const c={}; m.ev.filter(e=>e.side==="me"&&isGoal(e)&&e.rel).forEach(e=>c[e.rel]=(c[e.rel]||0)+1); m.assists=Object.keys(c).map(n=>({name:n,n:c[n]})); }
    }
  });
  D.played=D.matches.filter(m=>m.played);
  /* 過去の試合（対戦成績だけに使う） */
  D.past=(got.past||[]).map(o=>{ const gf=num(F(o,"得点")), ga=num(F(o,"失点")), opp=F(o,"相手"); if(!opp||gf==null||ga==null) return null;
    let ha=F(o,"H/A").toUpperCase(); ha=/^A/.test(ha)?"A":/^N/.test(ha)?"N":"H";
    return { season:F(o,"シーズン"), date:pDate(F(o,"日付")), comp:F(o,"大会"), round:F(o,"節・回戦"), ha, opp, gf, ga, venue:F(o,"会場"), memo:F(o,"メモ") }; }).filter(Boolean);
  D.posts=(got.posts||[]).map(o=>({ date:pDate(F(o,"日付")), url:Object.values(o).map(v=>String(v||"").trim()).find(v=>/^https?:\/\/(www\.)?(instagram\.com|x\.com|twitter\.com)\//.test(v))||"" }))
    .filter(x=>x.url).sort((a,b)=>(b.date||0)-(a.date||0));

  /* シーズン記録（試合ごとの記録がないシーズンの、選手ごとの出場・得点） */
  D.srec=(got.srec||[]).map(o=>({ season:F(o,"シーズン"), name:fullName(F(o,"名前")), no:num(F(o,"背番号")), apps:num(F(o,"出場")),
    g:num(F(o,"得点"))||0, a:num(F(o,"アシスト")), pos:F(o,"ポジション").toUpperCase() })).filter(r=>r.season && r.name);
  D.trans=got.trans.map((o,i)=>({ i, season:F(o,"シーズン"), date:pDate(F(o,"日付")), kind:F(o,"区分")||"加入", name:fullName(F(o,"名前")),
    club:F(o,"前所属・移籍先")||F(o,"相手クラブ"), fee:num(F(o,"移籍金")), memo:F(o,"メモ"), ex:isEx(o) })).filter(t=>t.name && !t.ex);
  D.trans.forEach(t=>{ if(!t.season && t.date) t.season=String(t.date.getMonth()<3 ? t.date.getFullYear()-1 : t.date.getFullYear()); });
  /* お知らせ（自由に書けるニュース） */
  D.notices=got.notice.map((o,i)=>({ i, date:pDate(F(o,"日付")), catJP:F(o,"カテゴリ")||"お知らせ", title:F(o,"タイトル"), body:F(o,"本文"), img:F(o,"画像"), link:F(o,"リンク"), ex:isEx(o) }))
    .filter(n=>n.title && !n.ex).map(n=>({...n, cat:NOTICE_CAT[n.catJP]||"NOTICE"}));
  D.seasons=got.season.map(o=>({ season:F(o,"シーズン"), league:F(o,"リーグ"), rank:half(F(o,"リーグ順位")).replace(/位$/,""), cup:F(o,"市民大会"),
    lcup:F(o,"播州大会"), intl:F(o,"その他の大会"), cups:F(o,"カップ戦"), cap:fullName(F(o,"主将")), comment:F(o,"一言"),
    rec:["勝","分","負","得点","失点"].map(k=>num(F(o,k))) })).filter(s=>s.season);
  D.hist=(got.hist||[]).map(o=>({ y:half(F(o,"年")), t:F(o,"出来事") })).filter(h=>/^\d{4}/.test(h.y) && h.t);
  D.table=got.table.map(o=>({ season:F(o,"シーズン"), comp:F(o,"大会"), rank:num(F(o,"順位")), club:F(o,"クラブ"), p:num(F(o,"試合")),
    w:num(F(o,"勝")), d:num(F(o,"分")), l:num(F(o,"負")), gf:num(F(o,"得点")), ga:num(F(o,"失点")), pts:num(F(o,"勝点")) })).filter(r=>r.club);

  const ss=new Set([...D.matches,...D.trans,...D.table].map(x=>x.season).filter(Boolean));
  if(D.conf["最初のシーズン"] && !ss.size) ss.add(D.conf["最初のシーズン"]);
  D.seasonList=[...ss].sort().reverse();
  const lastPlayed=D.played[D.played.length-1];
  ST.season = (lastPlayed && lastPlayed.season) || D.seasonList[0] || null;
  ST.stSeason = ST.trSeason = ST.season || "";
  buildNews();
  D.loaded=true;
  ["hd-name","ft-club","ft-name"].forEach(id=>{ if($(id)) $(id).textContent=clubName(); });
  if($("hd-en")) $("hd-en").textContent = clubEn();
  if($("ft-desc")) $("ft-desc").textContent = `${D.conf["所属リーグ"]?D.conf["所属リーグ"]+"に所属する":""}社会人サッカーチームです。`;
  /* SNS（設定シートの Instagram / X / YouTube にURLを入れると出る） */
  const SNS_ICON={ Instagram:'<path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.3.1 4.8 1.7 4.9 4.9.1 1.3.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.2-1.7 4.8-4.9 4.9-1.3.1-1.6.1-4.8.1s-3.6 0-4.8-.1c-3.3-.1-4.8-1.7-4.9-4.9C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.8C2.4 3.9 3.9 2.4 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 7a5 5 0 100 10 5 5 0 000-10zm0 8.2a3.2 3.2 0 110-6.4 3.2 3.2 0 010 6.4zm5.2-9.6a1.2 1.2 0 100 2.4 1.2 1.2 0 000-2.4z"/>',
    X:'<path d="M18.2 2.3h3.4l-7.4 8.4 8.7 11.5h-6.8l-5.3-7-6.1 7H1.3l7.9-9L.9 2.3h7l4.8 6.3 5.5-6.3zm-1.2 17.9h1.9L7.1 4.2H5.1l11.9 16z"/>',
    YouTube:'<path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.4 3.5 12 3.5 12 3.5s-7.4 0-9.4.6A3 3 0 00.5 6.2 31.9 31.9 0 000 12a31.9 31.9 0 00.5 5.8 3 3 0 002.1 2.1c2 .6 9.4.6 9.4.6s7.4 0 9.4-.6a3 3 0 002.1-2.1A31.9 31.9 0 0024 12a31.9 31.9 0 00-.5-5.8zM9.8 15V9l6.5 3-6.5 3z"/>' };
  const sns=Object.keys(SNS_ICON).filter(k=>/^https?:\/\//.test(D.conf[k]||"")).map(k=>`<a href="${esc(D.conf[k])}" target="_blank" rel="noopener" aria-label="${k}"><svg viewBox="0 0 24 24">${SNS_ICON[k]}</svg></a>`).join("");
  $("ft-sns").innerHTML=sns; $("drawer-sns").innerHTML=sns; if($("hd-sns")) $("hd-sns").innerHTML=sns;
  D.snsHtml=sns;
}
const BALL = '<svg class="ball" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="#fff" stroke="currentColor" stroke-width="1.5"/><path d="M12 7.2l3.6 2.6-1.4 4.2H9.8L8.4 9.8z" fill="currentColor"/><path d="M12 7.2V2.5M15.6 9.8l4.6-1.6M14.2 14l2.9 3.9M9.8 14l-2.9 3.9M8.4 9.8L3.8 8.2" stroke="currentColor" stroke-width="1.3"/></svg>';
const isGoal = e => /^(ゴール|PKゴール|FKゴール)$/.test(e.kind);

/* ---------- 集計 ---------- */
const ofSeason = s => D.played.filter(m=>!s || m.season===s);
/* 順位・勝点と並べる成績はリーグ戦だけ（カップ戦は入れない） */
const leagueOf = s => { const L=ofSeason(s), lg=L.filter(m=>/リーグ/.test(m.comp||"")); return lg.length?lg:L; };
function record(L){
  const r={n:L.length,w:0,d:0,l:0,gf:0,ga:0,cs:0};
  L.forEach(m=>{ if(m.draw) r.d++; else if(m.res==="W") r.w++; else r.l++; r.gf+=m.gf; r.ga+=m.ga; if(m.ga===0) r.cs++; });
  return r;
}
const seasonInfo = s => D.seasons.find(x=>x.season===s) || null;
function myRank(s){
  const S=seasonInfo(s); if(S && S.rank) return S.rank;
  const t=D.table.filter(r=>r.season===s && isMe(r.club));
  return t.length ? String(t[0].rank||"") : "";
}
function leagueName(s){
  const S=seasonInfo(s); if(S && S.league) return S.league;
  const L=ofSeason(s).filter(m=>/リーグ|League|J1|J2|J3/i.test(m.comp));
  return L.length ? L[0].comp : "";
}
/* チームの値：チームスタッツシート → なければ出場選手の合計 */
function teamVal(m, side, h){
  const t=m.ts[side]||{};
  if(t[h]!=null) return t[h];
  const L=m.lu[side].filter(l=>l.s[h]!=null);
  if(!L.length || h==="ボール支配率") return null;
  return MAX_KEYS[h] ? Math.max(...L.map(l=>l.s[h])) : AVG_KEYS[h] ? L.reduce((a,l)=>a+l.s[h],0)/L.length : L.reduce((a,l)=>a+l.s[h],0);
}
function fromMatches(s){
  const M={}; const add=(n,k,v)=>{ if(!n) return; (M[n]=M[n]||{name:n,得点:0,アシスト:0,mom:0})[k]+=v; };
  ofSeason(s).forEach(m=>{ m.scorers.forEach(x=>add(x.name,"得点",x.n)); m.assists.forEach(x=>add(x.name,"アシスト",x.n)); if(m.mom) add(m.mom,"mom",1); });
  return Object.values(M).map(o=>({...o, g:o.得点, a:o.アシスト}));
}
/* 出場選手シートから、選手のシーズン成績（合計）を作る。s=""なら通算 */
function srecRows(s){
  return D.srec.filter(r=>r.season===s).map(r=>({ name:r.name, season:s, apps:r.apps, starts:0, cs:0, mom:0, pos:r.pos||"", no:r.no, _n:{}, src:"srec",
    "得点":r.g, "アシスト":r.a, g:r.g, a:r.a, yc:0, rc:0, min:null }));
}
function luAgg(s){
  if(!s && !D.srec.length) return luAggRaw("");
  if(s){ const L=luAggRaw(s), have=new Set(L.map(r=>nameKey(r.name))); return L.concat(srecRows(s).filter(r=>!have.has(nameKey(r.name)))); }
  /* 通算：シーズンごとの成績を足す */
  const M={};
  D.seasonList.forEach(se=>luAgg(se).forEach(r=>{ const k=nameKey(r.name);
    const o=M[k]=M[k]||{name:r.name,season:"",apps:null,starts:0,cs:0,mom:0,pos:"",no:null,_n:{},g:0,a:null,"得点":0,"アシスト":null,yc:0,rc:0,min:null};
    if(r.apps!=null) o.apps=(o.apps||0)+r.apps; o.starts+=r.starts||0; o.cs+=r.cs||0; o.mom+=r.mom||0;
    o.g+=r.g||0; if(r.a!=null) o._a=(o._a||0)+r.a; o.a=o._a??null; o["得点"]=o.g; o["アシスト"]=o.a; o.yc+=r.yc||0; o.rc+=r.rc||0; if(r.min!=null) o.min=(o.min||0)+r.min;
    if(r.pos) o.pos=r.pos; if(r.no!=null) o.no=r.no; }));
  return Object.values(M);
}
function luAggRaw(s){
  const M={};
  D.lineups.filter(l=>l.side==="me" && l.m && l.m.played && (!s || l.m.season===s) && (l.role!=="ベンチ" || l.min)).forEach(l=>{
    const k=nameKey(l.name);
    const o=M[k]=M[k]||{name:l.name,season:s,apps:0,starts:0,cs:0,mom:0,pos:"",no:null,_n:{}};
    o.apps++; if(l.role==="先発") o.starts++; if(l.pos) o.pos=l.pos; if(l.no!=null) o.no=l.no;
    Object.keys(l.s).forEach(h=>{ const v=l.s[h]; o[h]= MAX_KEYS[h] ? Math.max(o[h]??0, v) : (o[h]||0)+v; o._n[h]=(o._n[h]||0)+1; });
    if(l.pos==="GK" && l.role==="先発" && l.m.ga===0) o.cs++;
    if(same(l.m.mom,l.name)) o.mom++;
  });
  return Object.values(M).map(o=>({...o, g:o["得点"]||0, a:o["アシスト"]||0, yc:o["警告"]||0, rc:o["退場"]||0, min:o["出場時間"]||0}));
}
const seasonRows = s => luAgg(s);
function statRowsFor(s){
  const L=luAgg(s);
  if(L.length) return L;
  return fromMatches(s);
}
function seasonsOfPlayer(name){
  return D.seasonList.slice().sort().map(s=>seasonRows(s).find(r=>same(r.name,name))).filter(Boolean);
}
const latestStat = name => { const L=seasonsOfPlayer(name); return L[L.length-1]||null; };
const profile = name => D.players.find(p=>same(p.name,name)) || null;
const PLAYER_ROLES = ["主将","副主将","キャプテン","副キャプテン"];
const CLUB_ROLES = ["代表","副代表"];  /* クラブの役職。スタッフ（現場）には入れない */
const ROLE_ORDER = ["監督","ヘッドコーチ","コーチ","GKコーチ","トレーナー","マネージャー"];
function rolesOf(name){ const P=profile(name), R=[...((P&&P.roles)||[])], c=D.conf;
  if(same(c["代表者"],name) && !R.includes("代表")) R.push("代表"); if(same(c["監督名"],name) && !R.includes("監督")) R.push("監督");
  if(String(c["コーチ"]||"").split(/[、,，]/).some(x=>same(x.trim(),name)) && !R.includes("コーチ")) R.push("コーチ"); return R; }
const staffRolesOf = name => rolesOf(name).filter(r=>!PLAYER_ROLES.includes(r)&&!CLUB_ROLES.includes(r));
const clubRoleHolder = role => { const P=D.players.find(p=>rolesOf(p.name).includes(role)); return P?P.name:(role==="代表"?String(D.conf["代表者"]||D.conf["代表"]||"").trim():""); };
const roleRank = r => { const i=ROLE_ORDER.indexOf(r); return i<0?50:i; };
/* スタッフ一覧（役職がある人。主将などは選手の役割なので除く） */
function staffList(){
  const names=[...new Set([...D.players.map(p=>p.name), ...[D.conf["代表者"],D.conf["監督名"],...String(D.conf["コーチ"]||"").split(/[、,，]/)].map(x=>String(x||"").trim()).filter(Boolean)])];
  return names.map(n=>({ name:n, roles:staffRolesOf(n), P:profile(n) })).filter(x=>x.roles.length)
    .sort((a,b)=>roleRank(a.roles[0])-roleRank(b.roles[0]) || a.name.localeCompare(b.name,"ja"));
}
const staffOf = role => staffList().find(x=>x.roles.includes(role));
/* 選手ページのURL：選手シートの「ID」（例 utsumi-tomoaki）。IDがない選手は名前から作った英数字 */
const hash36 = s => { let h=5381; for(const c of String(s)) h=((h<<5)+h+c.codePointAt(0))>>>0; return h.toString(36); };
function pid(name){ const n=fullName(name), P=profile(n); return (P&&P.id) || "p-"+hash36(nameKey(n)); }
function nameFromPid(id){
  id=String(id||"").toLowerCase();
  const P=D.players.find(p=>p.id && p.id===id); if(P) return P.name;
  const pool=[...D.players.map(p=>p.name), ...D.lineups.filter(l=>l.side==="me").map(l=>l.name), ...D.srec.map(r=>r.name), ...D.trans.map(t=>t.name)];
  const hit=pool.find(n=>"p-"+hash36(nameKey(n))===id);
  return hit || fullName(decodeURIComponent(id));   /* 古い（日本語の）URLもそのまま開けるように */
}
function ageAt(birth, season){
  if(!birth) return null; const y=parseInt(season,10); const ref=y? new Date(y,7,1) : new Date();
  let a=ref.getFullYear()-birth.getFullYear(); if(ref < new Date(ref.getFullYear(), birth.getMonth(), birth.getDate())) a--; return a;
}
const IN_K=["加入","復帰","レンタル加入","昇格","レンタル復帰"], OUT_K=["退団","レンタル移籍"];
const trDir = k => IN_K.includes(k)?"in" : OUT_K.includes(k)?"out" : "etc";
const money = v => v==null ? "" : `${nf(v)}${esc(unit())}`;
function topOf(s, k){
  let rows=statRowsFor(s).filter(r=>r[k]); if(!rows.length) rows=fromMatches(s).filter(r=>r[k]);
  rows.sort((a,b)=>b[k]-a[k]); return rows[0]||null;
}

/* ---------- 選手の指標 ----------
   [名前, 合計から値を出す式, 単位, 小数の桁, 1試合平均も出す, ランキングに載る条件] */
const per = (T,h) => T.apps ? (T[h]||0)/T.apps : null;
const mean = (T,h) => (T._n && T._n[h]) ? T[h]/T._n[h] : null;   /* 評価・割合は平均 */
const sumOf = (T,L) => L.some(h=>T[h]!=null) ? L.reduce((a,h)=>a+(T[h]||0),0) : null;
const tkl = T => T["タックル"]!=null ? T["タックル"] : sumOf(T,["スタンディングタックル","スライディングタックル"]);
const tklW = T => sumOf(T,["スタンディングタックル成功","スライディングタックル成功"]);
const LB_P = [["FW",["間","外","上"]],["MF",["間","外","上"]],["DF",["間"]]];
const LB_D = [["FW",["間","外"]],["MF",["間","外"]],["DF",["間","外"]]];
const lbItems = (how, L) => L.flatMap(([l,ws])=>ws.map(w=>{ const k=`${how}で${l}ライン突破（${w}）`;
  return [`${k}成功`, T=>T[`${k}成功`], "回", 0, 0, null, T=>T[`${k}試み`]]; }));
const PM = [
  ["概要", [
    ["出場試合数", T=>T.apps, "試合"], ["先発", T=>T.starts, "試合"], ["出場時間", T=>T["出場時間"], "分"], ["MOM", T=>T.mom, "回"],
    ["平均評価", T=>mean(T,"評価"), "", 2, 0, T=>T.apps],
    ["得点", T=>T["得点"], "点", 0, 1], ["アシスト", T=>T["アシスト"], "", 0, 1], ["得点＋アシスト", T=>T["アシスト"]==null?null:(T["得点"]||0)+T["アシスト"], "", 0, 1],
    ["シュート", T=>T["シュート"], "本", 0, 1], ["シュート精度", T=>rate(T["枠内シュート"],T["シュート"]), "%", 1, 0, T=>T["シュート"]],
    ["パス", T=>T["パス"], "本", 0, 1], ["パス成功率", T=>rate(T["パス成功"],T["パス"]), "%", 1, 0, T=>T["パス"]],
    ["ドリブル", T=>T["ドリブル"], "回", 0, 1], ["ドリブル成功率", T=>rate(T["ドリブル成功"],T["ドリブル"]), "%", 1, 0, T=>T["ドリブル"]],
    ["タックル", tkl, "回", 0, 1], ["タックル成功率", T=>rate(tklW(T),tkl(T)), "%", 1, 0, tkl],
    ["オフサイド", T=>T["オフサイド"], "回"], ["ファウル", T=>T["ファウル"], "回"],
    ["ボール奪取", T=>T["ボール奪取"], "回", 0, 1], ["ボールロスト", T=>T["ボールロスト"], "回", 0, 1],
    ["走行距離", T=>T["走行距離"], "km", 1, 1], ["スプリント距離", T=>T["スプリント距離"], "km", 2, 1] ]],
  ["ポゼッション", [
    ["ボール保持率", T=>mean(T,"ボール保持率"), "%", 1], ["ドリブル成功", T=>T["ドリブル成功"], "回", 0, 1], ["ドリブル距離", T=>T["ドリブル距離"], "km", 2, 1],
    ["タックルされた回数", T=>T["タックルされた回数"], "回"], ["獲得CK", T=>T["獲得CK"], "本"], ["被ファウル", T=>T["被ファウル"], "回"], ["獲得PK", T=>T["獲得PK"], "回"],
    ["ダミーからのアシスト", T=>T["ダミーからのアシスト"], ""],
    ["通常ドリブル率", T=>mean(T,"通常ドリブル率"), "%", 1], ["シールドドリブル率", T=>mean(T,"シールドドリブル率"), "%", 1],
    ["ストレイフドリブル率", T=>mean(T,"ストレイフドリブル率"), "%", 1], ["アジャイルドリブル率", T=>mean(T,"アジャイルドリブル率"), "%", 1],
    ["抜き去り", T=>T["抜き去り"], "回", 0, 1], ["スキルムーブで抜き去り", T=>T["スキルムーブで抜き去り"], "回"], ["股抜き", T=>T["股抜き"], "回"], ["縦への突破", T=>T["縦への突破"], "回"],
    ...lbItems("ドリブル", LB_D) ]],
  ["シュート", [
    ["PKを除くゴール", T=>T["PKを除くゴール"], "点"], ["PKを除くゴール期待値", T=>T["PKを除くゴール期待値"], "", 2, 1],
    ["得点とゴール期待値の差", T=>T["PKを除くゴール期待値"]!=null?(T["PKを除くゴール"]??((T["得点"]||0)-(T["PKゴール"]||0)))-T["PKを除くゴール期待値"]:null, "", 2],
    ["枠内シュート", T=>T["枠内シュート"], "本", 0, 1], ["枠外シュート", T=>T["枠外シュート"], "本"], ["ブロックされたシュート", T=>T["ブロックされたシュート"], "本"],
    ["シュート決定率", T=>rate(T["得点"]||0,T["シュート"]), "%", 1, 0, T=>T["シュート"]],
    ["FKゴール", T=>T["FKゴール"], "点"], ["PKゴール", T=>T["PKゴール"], "点"], ["PK戦ゴール", T=>T["PK戦ゴール"], "点"], ["シュートからのアシスト", T=>T["シュートからのアシスト"], ""],
    ["通常シュート", T=>T["通常シュート"], "本"], ["フィネスシュート", T=>T["フィネスシュート"], "本"], ["ヘディングシュート", T=>T["ヘディングシュート"], "本"],
    ["パワーシュート", T=>T["パワーシュート"], "本"], ["ボレーシュート", T=>T["ボレーシュート"], "本"], ["チップシュート", T=>T["チップシュート"], "本"], ["セットプレーのシュート", T=>T["セットプレーのシュート"], "本"] ]],
  ["パス", [
    ["期待アシスト", T=>T["期待アシスト"], "", 2, 1], ["セカンドアシスト", T=>T["セカンドアシスト"], ""], ["キーパス", T=>T["キーパス"], "本", 0, 1],
    ["パスで抜いた人数", T=>T["パスで抜いた人数"], "人", 0, 1], ["パス成功", T=>T["パス成功"], "本", 0, 1], ["パスカットされた", T=>T["パスカットされた"], "本"], ["オフサイドのパス", T=>T["オフサイドのパス"], "本"],
    ["クロス", T=>T["クロス"], "本", 0, 1], ["クロス成功", T=>T["クロス成功"], "本"], ["クロス成功率", T=>rate(T["クロス成功"],T["クロス"]), "%", 1, 0, T=>T["クロス"]], ["ブロックされたクロス", T=>T["ブロックされたクロス"], "本"],
    ["プレッシャー下のパス", T=>T["プレッシャー下のパス"], "本", 0, 1], ["プレッシャー下のパス成功率", T=>rate(T["プレッシャー下のパス成功"],T["プレッシャー下のパス"]), "%", 1, 0, T=>T["プレッシャー下のパス"]],
    ["グラウンダーパス", T=>T["グラウンダーパス"], "本"], ["ロブパス", T=>T["ロブパス"], "本"], ["スルーパス", T=>T["スルーパス"], "本"], ["ロブスルーパス", T=>T["ロブスルーパス"], "本"], ["セットプレーのパス", T=>T["セットプレーのパス"], "本"],
    ...lbItems("パス", LB_P) ]],
  ["守備", [
    ["スタンディングタックル", T=>T["スタンディングタックル"], "回", 0, 1], ["スタンディングタックル成功率", T=>rate(T["スタンディングタックル成功"],T["スタンディングタックル"]), "%", 1, 0, T=>T["スタンディングタックル"]],
    ["スライディングタックル", T=>T["スライディングタックル"], "回", 0, 1], ["スライディングタックル成功率", T=>rate(T["スライディングタックル成功"],T["スライディングタックル"]), "%", 1, 0, T=>T["スライディングタックル"]],
    ["インターセプト", T=>T["インターセプト"], "回", 0, 1], ["ブロック", T=>T["ブロック"], "回"], ["クリア", T=>T["クリア"], "回", 0, 1], ["オフサイド誘発", T=>T["オフサイド誘発"], "回"],
    ["オフェンスデュエル勝利", T=>T["オフェンスデュエル勝利"], "回"], ["オフェンスデュエル勝率", T=>rate(T["オフェンスデュエル勝利"],T["オフェンスデュエル"]), "%", 1, 0, T=>T["オフェンスデュエル"]],
    ["ディフェンスデュエル勝利", T=>T["ディフェンスデュエル勝利"], "回"], ["ディフェンスデュエル勝率", T=>rate(T["ディフェンスデュエル勝利"],T["ディフェンスデュエル"]), "%", 1, 0, T=>T["ディフェンスデュエル"]],
    ["空中戦勝利", T=>T["空中戦勝利"], "回"], ["空中戦勝率", T=>rate(T["空中戦勝利"],T["空中戦"]), "%", 1, 0, T=>T["空中戦"]],
    ["突破された回数", T=>T["突破された回数"], "回"], ["守備エリアで突破された回数", T=>T["守備エリアで突破された回数"], "回"], ["ボックス内で突破された回数", T=>T["ボックス内で突破された回数"], "回"],
    ["PK献上", T=>T["PK献上"], "回"], ["オウンゴール", T=>T["オウンゴール"], "点"], ["警告", T=>T["警告"], "枚"], ["退場", T=>T["退場"], "回"] ]],
  ["GK", [
    ["被シュート", T=>T["被シュート"], "本"], ["被枠内シュート", T=>T["被枠内シュート"], "本"], ["セーブ", T=>T["セーブ"], "回", 0, 1], ["失点", T=>T["失点"], "点", 0, 1],
    ["セーブ率", T=>rate(T["セーブ"],T["被枠内シュート"]), "%", 1, 0, T=>T["被枠内シュート"]], ["クリーンシート", T=>T.cs, "試合"],
    ["パンチング", T=>T["パンチング"], "回"], ["飛び出してのセーブ", T=>T["飛び出してのセーブ"], "回"],
    ["PKセーブ", T=>T["PKセーブ"], "回"], ["PK失点", T=>T["PK失点"], "点"], ["PK戦セーブ", T=>T["PK戦セーブ"], "回"], ["PK戦失点", T=>T["PK戦失点"], "点"],
    ["通常シュートをセーブ", T=>T["通常シュートをセーブ"], "回"], ["フィネスシュートをセーブ", T=>T["フィネスシュートをセーブ"], "回"], ["ヘディングをセーブ", T=>T["ヘディングをセーブ"], "回"],
    ["パワーシュートをセーブ", T=>T["パワーシュートをセーブ"], "回"], ["ボレーをセーブ", T=>T["ボレーをセーブ"], "回"], ["チップをセーブ", T=>T["チップをセーブ"], "回"], ["セットプレーをセーブ", T=>T["セットプレーをセーブ"], "回"] ]]
];
const PM_ALL = PM.flatMap(([g,L])=>L.map(x=>({g, k:x[0], f:x[1], u:x[2]||"", d:x[3]||0, avg:!!x[4], base:x[5]||x[6]||null})));
const fmtV = (v,d) => v==null||!isFinite(v) ? "-" : d ? (+v).toFixed(d) : nf(Math.round(v));
/* 1試合平均（走行距離などは記録がある試合数で割る） */
function avgOf(T, M){ const h=M.k; const n=(T._n&&T._n[h])||T.apps; const v=M.f(T); return (v!=null && n) ? v/n : null; }

/* =====================================================================
   ニュース（試合・移籍・シーズンの行から自動で作る）
   ===================================================================== */
const KIND_EN = { "加入":"NEW COMER", "レンタル加入":"NEW COMER", "昇格":"PROMOTION", "レンタル復帰":"WELCOME BACK", "退団":"FAREWELL", "レンタル移籍":"ON LOAN", "契約延長":"RENEWAL" };
const resJP = m => m.draw && !m.pk ? "引き分け" : m.res==="W" ? "勝利" : "敗戦";
const CAT_JP = { MATCH:"試合結果", INFO:"試合情報", SEASON:"シーズン", MEMBER:"加入・退団", NOTICE:"お知らせ", PRACTICE:"練習", TM:"練習試合", EVENT:"イベント", RECORD:"記録" };
const NOTICE_CAT = { "お知らせ":"NOTICE", "練習":"PRACTICE", "練習日":"PRACTICE", "練習試合":"TM", "トレーニングマッチ":"TM", "イベント":"EVENT", "記録":"RECORD", "チーム記録":"RECORD",
  "加入・退団":"MEMBER", "移籍":"MEMBER", "メンバー":"MEMBER", "試合":"MATCH", "試合結果":"MATCH", "試合情報":"INFO" };
const resWord = m => m.draw ? (m.pk ? (m.res==="W"?"PK戦の末に勝利":"PK戦の末に敗退") : "引き分け") : m.res==="W" ? "勝利" : "敗戦";
const resEN = m => !m.played ? "NEXT" : m.draw && m.pk ? (m.res==="W"?"WIN (PK)":"LOSE (PK)") : m.draw?"DRAW" : m.res==="W"?"WIN":"LOSE";
const resCls = m => !m.played ? "U" : m.draw && !m.pk ? "D" : m.res;
const compRound = m => [m.comp, m.round].filter(Boolean).join(" ");
/* 画面表示用：大会名と節は行を分ける */
const compRoundH = m => [m.comp, m.round].filter(Boolean).map(esc).join("<br>");
const sides = m => m.ha==="A" ? {home:m.opp, away:clubName(), hs:m.ga, as:m.gf, hSide:"opp", aSide:"me"} : {home:clubName(), away:m.opp, hs:m.gf, as:m.ga, hSide:"me", aSide:"opp"};

function buildNews(){
  const N=[];
  D.played.forEach(m=>N.push({ id:"m"+m.id, cat:"MATCH", date:m.date, sort:m.date, m,
    title:`【試合結果】${m.round||m.comp} vs ${m.opp}　${m.gf}-${m.ga}${m.pk?`（PK ${m.pk.a}-${m.pk.b}）`:""} ${resJP(m)}` }));
  const nx=D.matches.find(m=>!m.played);
  if(nx) N.push({ id:"n"+nx.id, cat:"INFO", date:null, sort:new Date(8640000000000000), nm:nx,
    title:`【試合情報】${nx.round||nx.comp} vs ${nx.opp}（${fmtMD(nx.date)}・${nx.ha==="H"?"ホーム":"アウェイ"}）` });
  D.trans.forEach(t=>{
    const who=`${t.name}選手`;
    const tt={ "加入":`${who} 加入のお知らせ`, "レンタル加入":`${who} 期限付き移籍加入のお知らせ`, "昇格":`${who} 昇格のお知らせ`,
      "レンタル復帰":`${who} 期限付き移籍からの復帰のお知らせ`, "退団":`${who} 退団のお知らせ`, "レンタル移籍":`${who} 期限付き移籍のお知らせ`,
      "契約延長":`${who} 契約延長のお知らせ` }[t.kind] || `${who} ${t.kind}のお知らせ`;
    N.push({ id:"t"+t.i, cat:"MEMBER", date:t.date, sort:t.date, t, title:tt });
  });
  D.notices.forEach(nt=>N.push({ id:"i"+nt.i, cat:nt.cat, date:nt.date, sort:nt.date, nt, title:nt.title, catLabel: CAT_JP[nt.cat]===nt.catJP ? "" : nt.catJP }));
  D.seasons.forEach(S=>{
    const L=ofSeason(S.season); const last=L.length? L[L.length-1].date : null;
    if(D.matches.some(m=>m.season===S.season && !m.played)) return;
    if(!L.length) return;
    const t=titlesOf(S);
    N.push({ id:"s"+S.season, cat:"SEASON", date:null, sort:last? new Date(last.getTime()+86400000) : null, S,
      title: t.length ? `${S.season}シーズン ${t.join("・")}！` : `${S.season}シーズンを終えて${S.rank?`（${S.league||"リーグ"} ${S.rank}位）`:""}` });
  });
  N.sort((a,b)=>(b.sort?b.sort.getTime():-1)-(a.sort?a.sort.getTime():-1));
  D.news=N;
}
function titlesOf(S){
  const t=[]; if(/^1$/.test(S.rank)) t.push(`${S.league||"リーグ"}優勝`);
  [["市民大会",S.cup],["播州大会",S.lcup],["その他の大会",S.intl]].forEach(([k,v])=>{ if(/^優勝/.test(v||"")) t.push(`${k}優勝`); });
  String(S.cups||"").split(/[／\/、\n]/).forEach(x=>{ const m=x.trim().match(/^(.+?)\s*優勝$/); if(m) t.push(`${m[1]}優勝`); });
  return t;
}
const mark = () => `<div class="nv-mark">${logo(clubName())}<span>${esc(clubName())}</span></div>`;
const newsImg = s => /^https?:\/\//.test(s) ? s : `images/news/${s}`;
function visual(n){
  if(n.nt) return n.nt.img ? `<div class="nd-img"><img src="${esc(encodeURI(newsImg(n.nt.img)))}" alt=""></div>` : "";
  if(n.m){ const m=n.m, S=sides(m);
    return `<div class="nv m ${resCls(m)}">
      <div class="nv-comp">${compRoundH(m)}</div><div class="nv-res">${resEN(m)}</div>
      <div class="nv-board"><div class="nv-team">${logo(S.home)}${esc(S.home)}</div>
        <div class="nv-score">${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}</div>
        <div class="nv-team">${logo(S.away)}${esc(S.away)}</div></div>
      <div class="nv-date">${fmtD(m.date)}</div>${mark()}</div>`; }
  if(n.t){ const t=n.t, P=profile(t.name), s=seasonRows(t.season).find(r=>same(r.name,t.name)) || latestStat(t.name);
    const dir=trDir(t.kind);
    const rows=[["NUMBER", s&&s.no!=null?s.no:""],["POSITION",(s&&s.pos)||(P&&P.pos)||""],["FROM",P&&P.nat||""],
      [dir==="out"?"NEXT CLUB":"PREVIOUS CLUB", t.club]].filter(r=>r[1]!=="" && r[1]!=null);
    return `<div class="nv t ${dir==="out"?"out":""}">
      <div class="nv-kind${(KIND_EN[t.kind]||t.kind).length>9?" long":""}">${esc(KIND_EN[t.kind]||t.kind)}<small>${esc(t.kind)}</small></div>
      <div class="nv-name">${esc(t.name)}</div>
      <dl class="nv-dl">${rows.map(([k,v])=>`<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
      <div class="nv-photo">${face(t.name)}</div>${mark()}</div>`; }
  const S=n.S, r=record(leagueOf(S.season)), t=titlesOf(S);
  return `<div class="nv s"><div class="nv-sn">${esc(S.season)} SEASON</div>
    <div class="nv-sbig">${S.rank?`${esc(S.rank)}<small>位</small>`:`${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small>`}</div>
    <div class="nv-stt">${t.length? t.map(x=>`<span>${esc(x)}</span>`).join("") : esc(S.league||"")}</div>${mark()}</div>`;
}
const nDate = n => n.date ? fmtD(n.date).replace(/\//g,".") : n.nm ? fmtD(n.nm.date).replace(/\//g,".") : esc((n.S&&n.S.season)||"");
const newsLine = n => `<a class="nl" href="${n.nm?`#match/${n.nm.id}`:`#news/${encodeURIComponent(n.id)}`}"><time>${nDate(n)}</time><span class="cat ${n.cat}">${esc(n.catLabel||CAT_JP[n.cat]||n.cat)}</span><p>${esc(n.title)}</p></a>`;
const newsCard = n => `<a class="ncard" href="#news/${encodeURIComponent(n.id)}"><div class="thumb">${visual(n)}</div>
  <div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span>${nDate(n)}</span></div><h3>${esc(n.title)}</h3></a>`;
const newsRow = n => `<a class="nrow" href="#news/${encodeURIComponent(n.id)}"><div class="thumb">${visual(n)}</div>
  <div><div class="meta"><span class="cat ${n.cat}">${n.cat}</span><span>${nDate(n)}</span></div><h3>${esc(n.title)}</h3></div></a>`;
const pLink = n => `<a href="#player/${pid(n)}"><b>${esc(n)}</b></a>`;
function newsBody(n){
  const P=[];
  if(n.nt){ String(n.nt.body||"").split(/\r?\n\s*\r?\n|\r?\n/).filter(x=>x.trim()).forEach(x=>P.push(`<p>${esc(x)}</p>`));
    if(/^https?:\/\//.test(n.nt.link||"")) P.push(`<div class="nd-link"><a class="btn" href="${esc(n.nt.link)}" target="_blank" rel="noopener">くわしく見る</a></div>`);
    return P.join(""); }
  if(n.m){ const m=n.m;
    P.push(`<p>${m.date?fmtDW(m.date)+"、":""}${esc(compRound(m))}で${esc(m.opp)}と対戦し、${m.gf}-${m.ga}${m.pk?`（PK ${m.pk.a}-${m.pk.b}）`:""}で${resWord(m)}しました。</p>`);
    if(m.scorers.length) P.push(`<p>得点は${m.scorers.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}点）`:""}`).join("、")}。${m.assists.length?`アシストは${m.assists.map(x=>`${pLink(x.name)}${x.n>1?`（${x.n}）`:""}`).join("、")}が記録しました。`:""}</p>`);
    else if(m.gf===0) P.push(`<p>攻撃陣はゴールを奪えませんでした。</p>`);
    const po=teamVal(m,"me","ボール支配率"), sm=teamVal(m,"me","シュート"), so=teamVal(m,"opp","シュート");
    if(po!=null || (sm!=null&&so!=null)) P.push(`<p>${po!=null?`ボール支配率は${fmtV(po,0)}%`:""}${po!=null&&sm!=null&&so!=null?"、":""}${sm!=null&&so!=null?`シュートは${sm}本対${so}本`:""}でした。</p>`);
    if(m.mom) P.push(`<p>マン・オブ・ザ・マッチには${pLink(m.mom)}が選ばれました。</p>`);
    if(m.venue) P.push(`<p>会場：${esc(m.venue)}</p>`);
    if(m.att) P.push(`<p>観客数：${nf(m.att)}人</p>`);
    if(m.memo) P.push(`<h2>コメント</h2><p>${esc(m.memo)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#match/${m.id}">試合の詳しい記録を見る</a></div>`);
  } else if(n.t){ const t=n.t, dir=trDir(t.kind), club=t.club?esc(t.club):"";
    const s={ "加入":`${club?`${club}より、`:""}${pLink(t.name)}選手が加入することが決まりました。`,
      "レンタル加入":`${club?`${club}より、`:""}${pLink(t.name)}選手が期限付き移籍で加入することが決まりました。`,
      "昇格":`${pLink(t.name)}選手がトップチームに昇格することが決まりました。`,
      "レンタル復帰":`${club?`期限付き移籍先の${club}から、`:""}${pLink(t.name)}選手が復帰することが決まりました。`,
      "退団":`${pLink(t.name)}選手が${club?`${club}へ移籍し、`:""}チームを離れることになりました。`,
      "レンタル移籍":`${pLink(t.name)}選手が${club?`${club}へ`:""}期限付き移籍することになりました。`,
      "契約延長":`${pLink(t.name)}選手と契約を延長しました。` }[t.kind] || `${pLink(t.name)}選手：${esc(t.kind)}`;
    P.push(`<p>${s}</p>`);
    if(t.fee) P.push(`<p>移籍金：${money(t.fee)}</p>`);
    const pr=profile(t.name);
    if(pr){ const it=[pr.pos&&`ポジション：${esc(pr.pos)}`, pr.nat&&`出身：${esc(pr.nat)}`, pr.birth&&`年齢：${ageAt(pr.birth,t.season)}歳`, pr.height&&`身長：${pr.height}cm`, pr.foot&&`利き足：${esc(pr.foot)}`].filter(Boolean);
      if(it.length) P.push(`<h2>プロフィール</h2><p>${it.join("<br>")}</p>`); }
    if(t.memo) P.push(`<h2>メモ</h2><p>${esc(t.memo)}</p>`);
    if(dir!=="out") P.push(`<div class="nd-link"><a class="btn" href="#player/${pid(t.name)}">選手プロフィールを見る</a></div>`);
  } else { const S=n.S, r=record(leagueOf(S.season));
    P.push(`<p>${esc(S.season)}シーズンが終了しました。${S.league?`${esc(S.league)}は${S.rank?`${esc(S.rank)}位`:""}`:""}${r.n?`、公式戦${r.n}試合で${r.w}勝${r.d}分${r.l}敗（${r.gf}得点・${r.ga}失点）`:""}でした。</p>`);
    const cups=[["",S.cups],["市民大会",S.cup],["播州大会",S.lcup],["その他の大会",S.intl]].filter(x=>x[1]);
    if(cups.length) P.push(`<p>${cups.map(([k,v])=>k?`${k}：${esc(v)}`:esc(v)).join("<br>")}</p>`);
    const top=topOf(S.season,"g"); if(top) P.push(`<p>チーム得点王は${pLink(top.name)}（${top.g}点）。</p>`);
    if(S.cap) P.push(`<p>主将：${pLink(S.cap)}</p>`);
    if(S.comment) P.push(`<h2>コメント</h2><p>${esc(S.comment)}</p>`);
    P.push(`<div class="nd-link"><a class="btn" href="#history">クラブの歴史を見る</a></div>`);
  }
  return P.join("");
}

/* =====================================================================
   画面
   ===================================================================== */
function seasonSel(id, val, all){
  const opts=(all?[["","通算"]]:[]).concat(D.seasonList.map(s=>[s,`${s}シーズン`]));
  if(!opts.length) return "";
  return `<select class="sel" id="${id}" aria-label="シーズンを選ぶ">${opts.map(([v,l])=>`<option value="${esc(v)}"${v===(val||"")?" selected":""}>${esc(l)}</option>`).join("")}</select>`;
}
const bindSel = (id, fn) => { const el=$(id); if(el) el.onchange=()=>fn(el.value); };
const band = (en, jp) => `<section class="pg-h"><div class="pg-in"><h1><span>${esc(en)}</span>${esc(jp)}</h1></div></section>`;
const secH = (en, jp, more, moreTxt) => `<div class="sec-h"><h2><span>${en}</span>${jp}</h2>${more?`<a class="more" href="${more}">${moreTxt||"一覧を見る"}</a>`:""}</div>`;
const dateEN = d => d ? `<b>${d.getMonth()+1}.${String(d.getDate()).padStart(2,"0")}<small>${WDE[d.getDay()]}</small></b>` : "<b>--</b>";

/* 試合カード（HOME） */
function matchBox(m, label){
  const S=sides(m);
  return `<div class="mbox"><div class="mbox-h"><b>${label}</b><span class="ha ${m.ha}" style="color:#fff">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
    <a class="mbox-b" href="#match/${m.id}">
      <div class="mdate">${dateEN(m.date)}<span style="font-size:12px;color:var(--ink2);font-weight:700">${m.date?m.date.getFullYear():""}</span></div>
      <div class="mcomp">${compRoundH(m)}</div>
      <div class="mboard"><div class="mteam">${logo(S.home)}${esc(S.home)}</div>
        <div class="mscore">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}`:`<span class="vs">VS</span>`}</div>
        <div class="mteam">${logo(S.away)}${esc(S.away)}</div></div>
      ${m.played?`<div class="mres"><span class="res ${resCls(m)}">${resEN(m)}</span></div>`:""}
    </a>
    <div class="mlinks">${m.played?`<a href="#match/${m.id}">試合詳細</a>${hasStats(m)?`<a href="#match/${m.id}/stats">スタッツ</a>`:""}${m.lu.me.length?`<a href="#match/${m.id}/lineup">出場選手</a>`:""}`
      :`<a href="#match">試合日程</a><a href="#match/${m.id}">対戦情報</a>`}</div></div>`;
}

/* ---------- 対戦成績 ---------- */
const TEAM_ALIAS = { "グリンキャッツ":"グリーンキャッツ", "airial":"エアリアル", "パシエンシア姫路fc":"パシエンシア", "津田scサテライト":"津田サテライト", "f.c.volts":"fcvolts", "エンヤサール灘":"エンヤサール灘fc" };
const nk = n => String(n||"").normalize("NFKC").toLowerCase().replace(/[\s　・.]/g,"");
function teamOf(n){ const k=nk(n); return D.teams.find(t=>nk(t.name)===k || t.alias.some(a=>nk(a)===k)) || null; }
function teamKey(n){ const t=teamOf(n); if(t) return nk(t.name); const k=nk(n); return nk(TEAM_ALIAS[k]||k); }
function h2hOf(opp, before){
  const k=teamKey(opp);
  const L=[...D.past.map(x=>({...x, past:true})), ...D.played.filter(m=>!before || m.id!==before.id)].filter(x=>teamKey(x.opp)===k)
    .sort((a,b)=>((b.date||new Date(+b.season||0,0,1))-(a.date||new Date(+a.season||0,0,1))));
  const r={n:L.length,w:0,d:0,l:0,gf:0,ga:0}; L.forEach(x=>{ if(x.gf>x.ga) r.w++; else if(x.gf===x.ga) r.d++; else r.l++; r.gf+=x.gf; r.ga+=x.ga; });
  return { r, L };
}
function h2hHtml(m){
  const {r,L}=h2hOf(m.opp, m.played?m:null); if(!r.n) return "";
  return `<section class="h2h"><h2 class="pd-h">対戦成績<small>vs ${esc(m.opp)}</small></h2>
    <div class="h2h-sum"><div><b>${r.n}</b><span>試合</span></div><div class="w"><b>${r.w}</b><span>勝</span></div><div><b>${r.d}</b><span>分</span></div><div class="l"><b>${r.l}</b><span>敗</span></div><div><b>${r.gf}-${r.ga}</b><span>得点-失点</span></div></div>
    <div class="tw"><table class="t"><thead><tr><th>シーズン</th><th>日付</th><th class="l">大会</th><th></th><th>スコア</th><th></th></tr></thead><tbody>
    ${L.slice(0,10).map(x=>{ const res=x.gf>x.ga?"W":x.gf===x.ga?"D":"L";
      return `<tr><td>${esc(x.season||"")}</td><td class="num">${x.date?fmtD(x.date):"-"}</td><td class="l">${esc((x.comp||"").replace(/姫路市社会人サッカー/,"姫路市"))}${x.round?`<br>${esc(x.round)}`:""}</td><td><span class="ha ${x.ha}">${x.ha==="H"?"HOME":x.ha==="A"?"AWAY":"N"}</span></td>
        <td class="num">${x.past?`${x.gf}-${x.ga}`:`<a href="#match/${x.id}">${x.gf}-${x.ga}</a>`}</td><td><span class="res ${res}">${res==="W"?"WIN":res==="D"?"DRAW":"LOSE"}</span></td></tr>`; }).join("")}</tbody></table></div></section>`;
}
/* ---------- カレンダーに追加 ---------- */
const icsDate = (d,t) => { const p=n=>String(n).padStart(2,"0"); if(!t) return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}`;
  const [h,mi]=t.split(":").map(Number); return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}T${p(h)}${p(mi)}00`; };
function icsEvent(m){
  const S=sides(m), title=`${S.home} vs ${S.away}（${compRound(m)}）`, d=m.date;
  let st, en;
  if(m.time){ st=`DTSTART;TZID=Asia/Tokyo:${icsDate(d,m.time)}`; const [h,mi]=m.time.split(":").map(Number); const e=new Date(d); e.setHours(h, mi+90); en=`DTEND;TZID=Asia/Tokyo:${icsDate(e, `${e.getHours()}:${e.getMinutes()}`)}`; }
  else { st=`DTSTART;VALUE=DATE:${icsDate(d)}`; const e=new Date(d); e.setDate(e.getDate()+1); en=`DTEND;VALUE=DATE:${icsDate(e)}`; }
  return ["BEGIN:VEVENT",`UID:himejifc-${m.key.replace(/\//g,"")}-${m.id}@himejifc`,`DTSTAMP:${icsDate(new Date(),"0:00")}Z`,st,en,`SUMMARY:${title}`,m.venue?`LOCATION:${m.venue}`:"",`DESCRIPTION:${location.href.split("#")[0]}#match/${m.id}`,"END:VEVENT"].filter(Boolean).join("\r\n");
}
function downloadIcs(L, name){
  const txt=["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//HimejiFC//Schedule//JA","CALSCALE:GREGORIAN",...L.map(icsEvent),"END:VCALENDAR"].join("\r\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([txt],{type:"text/calendar"})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500);
}
function gcalUrl(m){
  const S=sides(m); let dates;
  if(m.time){ const [h,mi]=m.time.split(":").map(Number); const e=new Date(m.date); e.setHours(h, mi+90); dates=`${icsDate(m.date,m.time)}/${icsDate(e,`${e.getHours()}:${e.getMinutes()}`)}`; }
  else { const e=new Date(m.date); e.setDate(e.getDate()+1); dates=`${icsDate(m.date)}/${icsDate(e)}`; }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${S.home} vs ${S.away}（${compRound(m)}）`)}&dates=${dates}&ctz=Asia/Tokyo&location=${encodeURIComponent(m.venue||"")}`;
}
const calBtns = m => `<div class="cal"><button class="btn line cal-ics" data-id="${m.id}">カレンダーに追加</button><a class="btn line" href="${gcalUrl(m)}" target="_blank" rel="noopener">Googleカレンダー</a></div>`;
function bindCal(){
  document.querySelectorAll(".cal-ics").forEach(b=>b.onclick=()=>{ const m=D.matches.find(x=>x.id===+b.dataset.id); if(m) downloadIcs([m], `himejifc-${m.key.replace(/\//g,"")}.ics`); });
  const all=$("cal-all"); if(all) all.onclick=()=>downloadIcs(D.matches.filter(m=>!m.played && m.date), "himejifc-schedule.ics");
}
/* ---------- シェア ---------- */
const SH_ICON = {
  line:'<path d="M12 3C6.5 3 2 6.6 2 11c0 3.9 3.5 7.2 8.3 7.9.3.1.8.2.9.5.1.3.1.7 0 1l-.1.9c0 .3-.2 1 .9.5s5.9-3.5 8-6C21.3 14.2 22 12.7 22 11c0-4.4-4.5-8-10-8z"/>',
  x:'<path d="M17.8 3h3.1l-6.8 7.7 8 10.6h-6.3l-4.9-6.4L5.3 21.3H2.2l7.3-8.3L1.8 3h6.4l4.4 5.9L17.8 3zm-1.1 16.4h1.7L7.4 4.8H5.6l11.1 14.6z"/>',
  fb:'<path d="M13.5 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.6-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.4H7.3v3.2h2.8V22h3.4z"/>',
  link:'<path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.5-3.5a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zm-3.5 4.9a3.5 3.5 0 0 1 0-5l2.1-2.1 1.4 1.4-2.1 2.1a1.5 1.5 0 1 0 2.1 2.1l2.1-2.1 1.4 1.4-2.1 2.1a3.5 3.5 0 0 1-4.9.1zm7.7-4.6-1.4-1.4 2.1-2.1a1.5 1.5 0 1 0-2.1-2.1l-2.1 2.1-1.4-1.4 2.1-2.1a3.5 3.5 0 1 1 4.9 4.9l-2.1 2.1z"/>' };
function shareBar(text){
  const u=encodeURIComponent(location.href), t=encodeURIComponent(text);
  const ic = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${SH_ICON[k]}</svg>`;
  return `<div class="share"><span>SHARE</span>
    <a class="sh" href="https://social-plugins.line.me/lineit/share?url=${u}" target="_blank" rel="noopener" aria-label="LINEで送る">${ic("line")}</a>
    <a class="sh" href="https://twitter.com/intent/tweet?text=${t}&url=${u}" target="_blank" rel="noopener" aria-label="Xでポスト">${ic("x")}</a>
    <a class="sh" href="https://www.facebook.com/sharer/sharer.php?u=${u}" target="_blank" rel="noopener" aria-label="Facebookでシェア">${ic("fb")}</a>
    <button class="sh copy-link" type="button" aria-label="リンクをコピー">${ic("link")}<i>コピーしました</i></button></div>`;
}
function bindShare(){ document.querySelectorAll(".copy-link").forEach(b=>b.onclick=async()=>{ try{ await navigator.clipboard.writeText(location.href); }catch(e){} b.classList.add("done"); setTimeout(()=>b.classList.remove("done"),1800); }); }

/* ---------- 公式SNS ---------- */
function snsSection(){
  const L=[["Instagram","instagram"],["X","x"],["YouTube","youtube"]].filter(([k])=>/^https?:\/\//.test(D.conf[k]||""));
  const posts=D.posts.slice(0,3);
  if(!L.length && !posts.length) return "";
  const emb = u => /instagram\.com/.test(u)
    ? `<blockquote class="instagram-media" data-instgrm-permalink="${esc(u)}" data-instgrm-version="14"><a href="${esc(u)}" target="_blank" rel="noopener">Instagramで見る</a></blockquote>`
    : `<blockquote class="twitter-tweet" data-lang="ja"><a href="${esc(u.replace("://x.com","://twitter.com"))}">Xで見る</a></blockquote>`;
  return `<section class="sns-band"><div class="wrap">${secH("OFFICIAL SNS","公式SNS")}
    ${posts.length?`<div class="sns-posts">${posts.map(x=>`<div class="sns-post">${emb(x.url)}</div>`).join("")}</div>`:""}
    ${L.length?`<div class="sns-big">${L.map(([k,c])=>`<a class="sns-b ${c}" href="${esc(D.conf[k])}" target="_blank" rel="noopener"><b>${k==="X"?"X（旧Twitter）":k}</b><span>${esc(D.conf[k].replace(/^https?:\/\/(www\.)?/,"").replace(/\/$/,""))}</span></a>`).join("")}</div>`:""}
  </div></section>`;
}
function loadEmbeds(){
  const need=k=>document.querySelector(k);
  const add=(src,cb)=>{ if(document.querySelector(`script[src="${src}"]`)){ cb&&cb(); return; } const sc=document.createElement("script"); sc.src=src; sc.async=true; sc.onload=()=>cb&&cb(); document.body.appendChild(sc); };
  if(need(".instagram-media")) add("https://www.instagram.com/embed.js", ()=>{ try{ window.instgrm && window.instgrm.Embeds.process(); }catch(e){} });
  if(need(".twitter-tweet")) add("https://platform.twitter.com/widgets.js", ()=>{ try{ window.twttr && window.twttr.widgets.load(); }catch(e){} });
}

/* ---------- HOME ---------- */
const haTag = m => `<span class="ha ${m.ha}">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span>`;
const daysTo = d => { if(!d) return null; const t=new Date(); t.setHours(0,0,0,0); return Math.round((d-t)/86400000); };
const pkTxt = m => m.pk ? `PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}` : "";
/* トップの大きな試合ブロック */
function heroMatch(m){
  const S=sides(m), dd=daysTo(m.date);
  return `<div class="hm">
    <div class="hm-top"><span class="hm-lb">${m.played?"LATEST RESULT":"NEXT MATCH"}</span>${!m.played&&dd!=null&&dd>=0?`<span class="hm-cd">${dd===0?"本日開催":`あと<b>${dd}</b>日`}</span>`:""}</div>
    <div class="hm-comp">${compRoundH(m)}</div>
    <div class="hm-date"><b>${m.date?`${m.date.getMonth()+1}.${String(m.date.getDate()).padStart(2,"0")}`:""}</b><span>${m.date?`${WDE[m.date.getDay()]}`:""}</span>${m.time?`<b class="t">${esc(m.time)}</b><span>KICK OFF</span>`:""}</div>
    <a class="hm-board" href="#match/${m.id}">
      <div class="hm-team">${logo(S.home)}<span>${esc(S.home)}</span></div>
      <div class="hm-score">${m.played?`${S.hs}<i>-</i>${S.as}${m.pk?`<small>${pkTxt(m)}</small>`:""}`:`<span class="vs">VS</span>`}</div>
      <div class="hm-team">${logo(S.away)}<span>${esc(S.away)}</span></div>
    </a>
    <div class="hm-foot">${haTag(m)}${m.venue?`<span class="hm-venue">${esc(m.venue)}</span>`:""}${m.played?`<span class="res ${resCls(m)}">${resEN(m)}</span>`:""}</div>
    <div class="hm-btns"><a class="btn" href="#match/${m.id}">${m.played?"試合結果を見る":"試合情報を見る"}</a>${m.played?`<a class="btn line" href="#match">試合日程・結果</a>`:`<button class="btn line cal-ics" data-id="${m.id}">カレンダーに追加</button>`}</div>
  </div>`;
}
/* 日程の横並びカード */
function schedCard(m, next){
  const S=sides(m);
  return `<a class="sc${m.played?" done":""}${next?" next":""}" href="#match/${m.id}">
    <div class="sc-h"><b>${m.date?`${m.date.getMonth()+1}.${String(m.date.getDate()).padStart(2,"0")}`:"--"}</b><small>${m.date?WDE[m.date.getDay()]:""}</small>${haTag(m)}</div>
    <div class="sc-c">${esc(m.round||m.comp)}${m.time&&!m.played?` / ${esc(m.time)}`:""}</div>
    <div class="sc-b">${logo(S.home)}<span class="sc-s">${m.played?`${S.hs}-${S.as}`:"VS"}</span>${logo(S.away)}</div>
    <div class="sc-o">vs ${esc(m.opp)}</div>
    <div class="sc-f">${m.played?`<span class="res ${resCls(m)}">${resEN(m)}</span>`:next?`<span class="res U">NEXT</span>`:`<span class="sc-v">${esc(m.venue||"")}</span>`}</div>
  </a>`;
}
function partnerLogos(L){
  return L.map(x=>{ const img = x.logo ? `<img src="${esc(encodeURI(/\.(png|jpe?g|webp|svg)$/i.test(x.logo)?`images/sponsor/${x.logo}`:x.logo))}" alt="${esc(x.name)}" loading="lazy">` : `<span>${esc(x.name)}</span>`;
    return x.url ? `<a class="pt" href="${esc(x.url)}" target="_blank" rel="noopener">${img}</a>` : `<div class="pt">${img}</div>`; }).join("");
}
function vHome(){
  const s=ST.season, r=record(leagueOf(s)), rk=myRank(s), lg=leagueName(s);
  const next=D.matches.find(m=>!m.played), last=D.played[D.played.length-1];
  const main=next||last, sideRes = next && last ? last : null;
  const sched=D.matches.filter(m=>!s || m.season===s);
  const tb=standing(s, null, true);
  const sq=squad(s).rows.slice().sort((a,b)=>(a.no??999)-(b.no??999));
  const partners=D.sponsors.filter(x=>x.kind!=="プラン");
  const pts = r.w*3+r.d;
  return `
  <section class="top">
    <div class="top-in">
      ${main?heroMatch(main):`<div class="hm"><div class="hm-comp">${esc(clubName())}</div></div>`}
      <aside class="top-side">
        ${sideRes?`<a class="lr" href="#match/${sideRes.id}"><span class="lr-lb">LATEST RESULT</span><span class="lr-c">${compRoundH(sideRes)}</span>
          <div class="lr-b">${logo(sides(sideRes).home)}<b>${sides(sideRes).hs}-${sides(sideRes).as}</b>${logo(sides(sideRes).away)}</div>
          <span class="lr-o">vs ${esc(sideRes.opp)}　<span class="res ${resCls(sideRes)}">${resEN(sideRes)}</span></span></a>`:""}
        <div class="rec"><div class="rec-h">${esc(s||"")} SEASON<small>${esc(lg||"")}</small></div>
          <div class="rec-g"><div><span>順位</span><b>${rk?esc(rk):"-"}<small>位</small></b></div><div><span>勝点</span><b>${pts}</b></div>
          <div><span>成績</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div><div><span>得失点</span><b>${r.gf-r.ga>0?"+":""}${r.gf-r.ga}</b></div></div></div>
      </aside>
    </div>
  </section>

  ${sched.length?`<section class="sched"><div class="wrap">
    ${secH("SCHEDULE","試合日程・結果","#match")}
    <div class="sc-strip" id="sc-strip">${sched.map(m=>schedCard(m, m===next)).join("")}</div>
  </div></section>`:""}

  <div class="wrap home-grid">
    <section>${secH("NEWS","ニュース","#news")}
      ${D.news.length?`<div class="nls">${D.news.slice(0,6).map(newsLine).join("")}</div>`:empty("ニュースはまだありません。")}</section>
    ${tb?`<section>${secH("STANDINGS","順位表","#table")}${tb}</section>`:""}
  </div>

  <section class="cta2"><div class="wrap">
    <a class="cta join" href="#join"><span class="cta-en">JOIN US</span><b>選手募集</b><p>一緒にプレーする仲間を探しています。${D.conf["練習場所"]?`<br>練習場所：${esc(D.conf["練習場所"])}`:""}</p><span class="cta-go">募集要項を見る</span></a>
    <a class="cta spon" href="#sponsor"><span class="cta-en">PARTNER</span><b>スポンサー募集</b><p>姫路FCの活動を支えてくださる企業・お店・個人の方を募集しています。</p><span class="cta-go">くわしく見る</span></a>
  </div></section>

  ${sq.length?`<section class="squad home-pl"><div class="wrap">${secH("PLAYERS","選手・スタッフ","#players","選手一覧へ")}
    <div class="pl-strip">${sq.map(playerCard).join("")}</div></div></section>`:""}

  ${snsSection()}
  <section class="partners"><div class="wrap">
    ${secH("PARTNERS","スポンサー")}
    ${partners.length?`<div class="pt-grid">${partnerLogos(partners)}</div>`:""}
    <a class="pt-wanted" href="#sponsor"><b>スポンサー募集中</b><span>ここに貴社のロゴを掲載しませんか</span></a>
  </div></section>`;
}
function bHome(){
  bindCal(); loadEmbeds();
  const box=$("sc-strip"); if(!box) return;
  const nx=box.querySelector(".sc.next") || [...box.querySelectorAll(".sc.done")].pop();
  if(nx) box.scrollLeft = Math.max(0, nx.offsetLeft - box.offsetLeft - (box.clientWidth>700 ? box.clientWidth/2 - nx.clientWidth/2 : 16));

}

/* ---------- 試合結果の入力ツール（#input）----------
   GoalNoteの試合ページの文字をそのまま貼る → 「試合」「出場選手」「試合経過」シートに貼る行を作る */
const SEC_WORDS = ["得点","警告・退場・グリーンカード","警告・退場","先発","控え","監督","交代","マッチオフィシャル","試合情報"];
function parseGoalNote(text){
  const L=String(text||"").replace(/ /g," ").split(/\r?\n/).map(x=>x.replace(/\s+$/,"")).map(x=>x.trim());
  const g={ round:"", date:null, time:"", venue:"", home:"", away:"", hs:null, as:null, pk:"", goals:[], cards:[], start:[], bench:[], subs:[], att:null, weather:"" };
  const di=L.findIndex(x=>/\d{4}\/\d{1,2}\/\d{1,2}/.test(x));
  const head=L.slice(0, di<0?5:di+1).join(" ");
  const rm=head.match(/第\s*(\d+)\s*節/) || head.match(/(\d+回戦|準々決勝|準決勝|決勝)/); if(rm) g.round = rm[0].replace(/\s/g,"");
  if(di>=0){ const m=L[di].match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/); g.date=new Date(+m[1],+m[2]-1,+m[3]); const t=L[di].match(/(\d{1,2}:\d{2})/); if(t) g.time=t[1];
    for(let k=di+1;k<L.length;k++){ if(!L[k]) continue; if(/^\[|試合終了|K\/O/.test(L[k])) break; g.venue=L[k]; break; } }
  const ko=L.findIndex(x=>/^K\/O$/i.test(x));
  if(ko>0){ for(let k=ko-1;k>=0;k--){ if(L[k] && !/^\[/.test(L[k])){ g.home=L[k]; break; } }
    for(let k=ko+1;k<L.length;k++){ if(!L[k]) continue; const tk=L[k].split(/\t+|\s{2,}|\s(?=\S)/);
      const m=L[k].match(/^(\d+)\s+(\d+)\s+前半\s+(\d+)\s+(\d+)\s+(.+)$/);
      if(m){ g.hs=+m[1]; g.as=+m[4]; g.away=m[5].trim(); } break; }
    const pkl=L.find(x=>/^\(?\s*(\d+)\s*PK\s*(\d+)\s*\)?$/i.test(x)) || L.find(x=>/PK/i.test(x) && /\d+\s*-\s*\d+/.test(x));
    if(pkl){ const m=pkl.match(/(\d+)\D+(\d+)/); if(m) g.pk=`${m[1]}-${m[2]}`; } }
  /* 区切りごとに分ける */
  const secs={}; let cur=null;
  L.forEach(x=>{ if(SEC_WORDS.includes(x)){ cur=x.replace(/^警告・退場.*$/,"警告"); secs[cur]=secs[cur]||[]; return; } if(cur && x) secs[cur].push(x); });
  const P = x => { const m=x.match(/^(\d+)\s+(?:(GK|DF|MF|FW)\s+)?(.+?)\s*(\(Cap\.\))?$/); return m ? { no:+m[1], pos:m[2]||"", name:m[3].trim(), cap:!!m[4] } : null; };
  const minOf = x => { const m=x.match(/^(\d+)(?:\+(\d+))?分/); return m ? { mn:+m[1], txt: m[2]? `${m[1]}+${m[2]}` : m[1] } : null; };
  (secs["先発"]||[]).forEach(x=>{ const p=P(x); if(p && p.pos) g.start.push(p); });
  (secs["控え"]||[]).forEach(x=>{ const p=P(x); if(p && p.pos) g.bench.push(p); });
  const half = Math.ceil(g.start.length/2);
  g.start.forEach((p,k)=>p.side = k<half ? "H" : "A");
  /* 交代：時間 → 下がる選手 → 入る選手 */
  { const S=secs["交代"]||[]; for(let k=0;k<S.length;k++){ const t=minOf(S[k]); if(!t) continue; const o=P(S[k+1]||""), n=P(S[k+2]||"");
      if(o && n){ g.subs.push({ ...t, out:o, in:n }); k+=2; } } }
  const all=()=>[...g.start, ...g.bench];
  const sideOfName = nm => { const p=all().find(x=>same(x.name,nm)); return p ? p.side : null; };
  g.subs.forEach(su=>{ const sd=sideOfName(su.out.name)||"H"; su.side=sd; const b=g.bench.find(x=>same(x.name,su.in.name)); if(b) b.side=sd; });
  /* ベンチで使われなかった選手は、前後の選手と同じチームに */
  g.bench.forEach((b,k)=>{ if(b.side) return; const prev=g.bench.slice(0,k).reverse().find(x=>x.side), next=g.bench.slice(k+1).find(x=>x.side); b.side=(prev||next||{side:"H"}).side; });
  /* 得点：時間 → 選手 → (1-0) の数字の動きでどちらのチームか */
  { const S=secs["得点"]||[]; const raw=[]; for(let k=0;k<S.length;k++){ const t=minOf(S[k]); if(!t) continue;
      const pl=P(S[k+1]||""); const sc=(S[k+2]||"").match(/\((\d+)\s*-\s*(\d+)\)/);
      if(pl) raw.push({ ...t, player:pl, og:/OG|オウンゴール/.test(S[k+1]||""), h: sc?+sc[1]:null, a: sc?+sc[2]:null });
      k += sc ? 2 : 1; }
    /* 時間順に並べて、スコアの数字が増えたほうのチームの得点 */
    raw.sort((x,y)=>x.mn-y.mn); let ph=0, pa=0;
    raw.forEach(x=>{ let side=null; if(x.h!=null){ side = x.h>ph ? "H" : x.a>pa ? "A" : null; ph=x.h; pa=x.a; }
      g.goals.push({ ...x, side: side || sideOfName(x.player.name) || "H" }); }); }
  /* 警告・退場 */
  { const S=secs["警告"]||[]; for(let k=0;k<S.length;k++){ const t=minOf(S[k]); if(!t) continue; const pl=P(S[k+1]||""); if(!pl) continue;
      let note="", kind="警告"; const nx=S[k+2]||""; if(nx && !minOf(nx) && !P(nx)){ note=nx; k++; }
      if(/退場|レッド|一発/.test(note+S[k])) kind="退場";
      g.cards.push({ ...t, side: sideOfName(pl.name)||"H", player:pl, kind, note:note.replace(/^(警告|退場)[:：\s]*/,"") }); k++; } }
  (secs["試合情報"]||[]).forEach(x=>{ let m=x.match(/^観客\s*(\d+)/); if(m) g.att=+m[1]; m=x.match(/^天候\s*(.+)$/); if(m) g.weather=m[1].trim(); });
  return g;
}
function buildRows(g, o){
  const me = isMe(g.home) ? "H" : isMe(g.away) ? "A" : (o.meSide||"H");
  const sideJP = sd => sd===me ? "自分" : "相手";
  const date=fmtD(g.date), full=HALF*2;
  const gf = me==="H"?g.hs:g.as, ga = me==="H"?g.as:g.hs;
  /* 出場時間 */
  const minFor = p => { const off=g.subs.find(su=>same(su.out.name,p.name)), on=g.subs.find(su=>same(su.in.name,p.name));
    if(on) return { role:"途中出場", min: (off? off.mn : full) - on.mn };
    if(g.start.includes(p)) return { role:"先発", min: off ? off.mn : full };
    return { role:"ベンチ", min:"" }; };
  const goalsOf = p => g.goals.filter(x=>!x.og && same(x.player.name,p.name)).length;
  const astOf = p => g.goals.filter(x=>x.side===me && x.ast && same(x.ast,p.name)).length;
  const cardOf = (p,k) => g.cards.filter(c=>c.kind===k && same(c.player.name,p.name)).length;
  const lu=[...g.start, ...g.bench].sort((a,b)=>(a.side===me?0:1)-(b.side===me?0:1)).map(p=>{ const r=minFor(p), gl=goalsOf(p), y=cardOf(p,"警告"), rc=cardOf(p,"退場");
    return rowOf("lineup",{"日付":date, "チーム":sideJP(p.side), "背番号":p.no, "名前":p.name, "ポジション":p.pos, "出場":r.role, "出場時間":r.min, "得点":gl||"", "アシスト":(p.side===me&&astOf(p))||"", "警告":y||"", "退場":rc||""}); });
  const sc={}; g.goals.filter(x=>x.side===me && !x.og).forEach(x=>sc[x.player.name]=(sc[x.player.name]||0)+1);
  const scorers=Object.keys(sc).map(n=>sc[n]>1?`${n}（${sc[n]}）`:n).join("、");
  const ev=[...g.goals.map(x=>[x.mn, date, x.txt, sideJP(x.side), x.og?"オウンゴール":"ゴール", x.player.name, x.side===me?(x.ast||""):"", ""]),
    ...g.cards.map(c=>[c.mn, date, c.txt, sideJP(c.side), c.kind, c.player.name, "", c.note]),
    ...g.subs.map(su=>[su.mn, date, su.txt, sideJP(su.side), "交代", su.in.name, su.out.name, su.mn===HALF?"ハーフタイム":""])].sort((a,b)=>a[0]-b[0]).map(r=>rowOf("events",{"日付":r[1], "分":r[2], "チーム":r[3], "種類":r[4], "選手":r[5], "関連する選手":r[6], "補足":r[7]}));
  const season = g.date ? String(g.date.getMonth()<3 ? g.date.getFullYear()-1 : g.date.getFullYear()) : "";
  const memo=o.memo||"";
  const match=[rowOf("match",{"シーズン":season, "大会":o.comp, "節・回戦":o.round, "日付":date, "キックオフ":g.time||"", "H/A":me, "相手":o.opp, "得点":gf, "失点":ga, "PK":g.pk||"", "得点者":scorers, "会場":o.venue, "メモ":memo, "観客数":g.att??""})];
  return { match, lu, ev, me };
}
let INPUT={ text:"", g:null, o:null };
/* 入力ページで作る行は、シートの見出しの並びに合わせる（列を足したり並べ替えてもズレない） */
const COLS={ match:["シーズン","大会","節・回戦","日付","キックオフ","H/A","相手","得点","失点","PK","得点者","MOM","会場","メモ","観客数","レポート","監督コメント","選手コメント"],
  lineup:["日付","チーム","背番号","名前","ポジション","出場","出場時間","得点","アシスト","警告","退場"],
  events:["日付","分","チーム","種類","選手","関連する選手","補足"] };
const colsOf = k => { const c=(D.cols&&D.cols[k])||[]; return c.filter(Boolean).length>=3 ? c : COLS[k]; };
const rowOf = (k,o) => colsOf(k).map(c=>o[c]??"");
function vInput(){
  const g=INPUT.g, opps=[...new Set([...D.matches.map(m=>m.opp), ...D.table.filter(r=>!isMe(r.club)).map(r=>r.club)])];
  let body="";
  if(g){
    const ex=D.matches.find(m=>m.key===fmtD(g.date));
    const oppRaw = isMe(g.home) ? g.away : g.home;
    const o = INPUT.o || { opp: ex ? ex.opp : ((teamOf(oppRaw)||{}).name || opps.find(x=>same(x,oppRaw)) || oppRaw), comp: ex ? ex.comp : (D.conf["所属リーグ"]||""), round: g.round || (ex&&ex.round) || "", venue: ex&&ex.venue ? ex.venue : g.venue, memo: ex&&ex.memo&&!/キックオフ/.test(ex.memo) ? ex.memo : "" };
    INPUT.o=o;
    const R=buildRows(g,o);
    const row = ex ? D.matches.filter(m=>true).indexOf(ex) : -1;
    const tsv = rows => rows.map(r=>r.map(v=>String(v??"").replace(/\t|\n/g," ")).join("\t")).join("\n");
    const tbl = (head, rows) => `<div class="tw"><table class="t in-t"><thead><tr>${head.map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${esc(v)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    const dupLu = D.lineups.some(l=>l.key===fmtD(g.date)), dupEv = D.matches.some(m=>m.key===fmtD(g.date) && m.ev.length);
    body=`<div class="in-sum"><b>${esc(g.home)} ${g.hs??"?"} - ${g.as??"?"} ${esc(g.away)}</b><span>${fmtDW(g.date)} ${esc(g.round)} ／ 得点${g.goals.length}・交代${g.subs.length}・警告${g.cards.length}・選手${g.start.length+g.bench.length}人</span></div>
      <div class="in-form">
        <label>相手チーム名<input id="in-opp" list="in-opps" value="${esc(o.opp)}"><datalist id="in-opps">${opps.map(x=>`<option value="${esc(x)}">`).join("")}</datalist></label>
        <label>大会<input id="in-comp" value="${esc(o.comp)}"></label>
        <label>節・回戦<input id="in-round" value="${esc(o.round)}"></label>
        <label>会場<input id="in-venue" value="${esc(o.venue)}"></label>
        <label class="wide">メモ<input id="in-memo" value="${esc(o.memo)}" placeholder="試合の一言など（なくてもOK）"></label>
      </div>
      ${(()=>{ const meS = isMe(g.home)?"H":isMe(g.away)?"A":"H"; const G=g.goals.map((x,i)=>({x,i})).filter(({x})=>x.side===meS && !x.og); if(!G.length) return "";
        const mates=[...g.start,...g.bench].filter(p=>p.side===meS).map(p=>p.name);
        return `<div class="in-ast"><h3>アシスト</h3><p>アシストした選手を選んでください（いなければ「なし」のまま）。「試合経過」の「関連する選手」に入ります。</p>
          ${G.map(({x,i})=>`<label><span class="t">${esc(x.txt)}'</span><b>${esc(x.player.name)}</b><select data-g="${i}" class="in-ast-sel"><option value="">なし</option>${mates.filter(n=>!same(n,x.player.name)).map(n=>`<option${same(n,x.ast||"")?" selected":""}>${esc(n)}</option>`).join("")}</select></label>`).join("")}</div>`; })()}
      <div class="in-step"><h3><span>1</span>「試合」シート</h3>
        <p>${ex?`この試合はもう<b>${ex.round||""} ${fmtMD(ex.date)} vs ${esc(ex.opp)}</b>として入っています。その行（日付が ${fmtD(ex.date)} の行）の <b>A列</b> をクリックして貼り付け（上書き）してください。`:"一番下の空いている行の <b>A列</b> をクリックして貼り付けてください。"}</p>
        <button class="btn copy" data-c="m">コピーする</button>${tbl(["シーズン","大会","節","日付","H/A","相手","得点","失点","PK","得点者","アシスト","MOM","会場","メモ","観客数"],R.match)}</div>
      <div class="in-step"><h3><span>2</span>「出場選手」シート（${R.lu.length}行）</h3>
        <p>${dupLu?`<b class="warn">この日の出場選手はもう入っています。二重にならないよう、先に古い行を消してください。</b><br>`:""}一番下の空いている行の <b>A列</b> をクリックして貼り付けてください。</p>
        <button class="btn copy" data-c="l">コピーする</button>${tbl(["日付","チーム","背番号","名前","ポジション","出場","出場時間","得点","アシスト","警告","退場"],R.lu)}</div>
      <div class="in-step"><h3><span>3</span>「試合経過」シート（${R.ev.length}行）</h3>
        <p>${dupEv?`<b class="warn">この日の試合経過はもう入っています。二重にならないよう、先に古い行を消してください。</b><br>`:""}一番下の空いている行の <b>A列</b> をクリックして貼り付けてください。</p>
        <button class="btn copy" data-c="e">コピーする</button>${tbl(["日付","分","チーム","種類","選手","関連する選手","補足"],R.ev)}</div>`;
    INPUT.tsv={ m:tsv(R.match), l:tsv(R.lu), e:tsv(R.ev) };
  }
  return `${band("INPUT","試合結果の入力")}<div class="wrap narrow in-wrap">
    <ol class="in-how"><li>GoalNoteで試合のページを開き、ページ全体を選んでコピー（スマホは長押し→全選択→コピー）</li><li>下の欄に貼り付けて「読み取る」</li><li>出てきた3つを、それぞれのシートに貼り付け</li></ol>
    <textarea id="in-text" placeholder="ここにGoalNoteの試合ページの文字を貼り付け">${esc(INPUT.text)}</textarea>
    <div class="in-btns"><button class="btn" id="in-go">読み取る</button>${g?`<button class="btn line" id="in-clear">クリア</button>`:""}</div>
    ${INPUT.err?`<p class="warn">${esc(INPUT.err)}</p>`:""}
    ${body}</div>`;
}
function bInput(){
  const go=$("in-go"); if(go) go.onclick=()=>{ INPUT.text=$("in-text").value; INPUT.o=null; INPUT.err="";
    try{ const g=parseGoalNote(INPUT.text); if(!g.date || g.hs==null){ INPUT.g=null; INPUT.err="試合のページとして読み取れませんでした。日付とスコアの部分も入るようにコピーしてください。"; } else INPUT.g=g; }
    catch(e){ console.error(e); INPUT.g=null; INPUT.err="読み取りに失敗しました。"; }
    render(); };
  const cl=$("in-clear"); if(cl) cl.onclick=()=>{ INPUT={text:"",g:null,o:null}; render(); };
  document.querySelectorAll(".in-ast-sel").forEach(sel=>sel.onchange=()=>{ INPUT.g.goals[+sel.dataset.g].ast=sel.value; const y=scrollY; render(); scrollTo(0,y); });
  ["opp","comp","round","venue","memo"].forEach(k=>{ const el=$("in-"+k); if(el) el.onchange=()=>{ INPUT.o[k]=el.value; const y=scrollY; render(); scrollTo(0,y); }; });
  document.querySelectorAll(".btn.copy").forEach(b=>b.onclick=async()=>{ const t=INPUT.tsv[b.dataset.c];
    try{ await navigator.clipboard.writeText(t); }catch(e){ const ta=document.createElement("textarea"); ta.value=t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    b.textContent="コピーしました"; b.classList.add("done"); setTimeout(()=>{ b.textContent="コピーする"; b.classList.remove("done"); },2000); });
}

/* ---------- 選手募集・スポンサー募集 ---------- */
const CONTACT_TYPES = { join:"入団・練習参加について", sponsor:"スポンサーについて", media:"取材について", other:"その他" };
/* [name, ラベル, 種類, 必須, 選択肢/placeholder, 横いっぱい] */
const CONTACT_FIELDS = {
  join:   [["お名前","お名前","text",1],["年齢","年齢","number",1],["email","メールアドレス","email",1],["電話番号","電話番号","tel",0],
           ["希望ポジション","希望ポジション","select",1,["GK","DF","MF","FW","どこでも"]],["サッカー歴","サッカー歴（学校・チームなど）","textarea",1,"例：○○高校サッカー部（3年間）、○○FC など",1],
           ["練習参加の希望日","練習参加の希望日","text",0,"例：○月○日、土曜日ならいつでも など",1],["内容","その他・ご質問","textarea",0,"",1]],
  sponsor:[["会社・団体名","会社・団体名","text",1],["お名前","ご担当者名","text",1],["email","メールアドレス","email",1],["電話番号","電話番号","tel",0],
           ["興味のあるプラン","興味のあるプラン","plan",0,"",1],["内容","お問い合わせ内容","textarea",1,"",1]],
  media:  [["媒体名","媒体名（新聞・テレビ・Webなど）","text",1],["お名前","ご担当者名","text",1],["email","メールアドレス","email",1],["電話番号","電話番号","tel",0],
           ["取材希望日","取材希望日","text",0,"",1],["内容","取材の内容","textarea",1,"",1]],
  other:  [["お名前","お名前","text",1],["email","メールアドレス","email",1],["電話番号","電話番号","tel",0],["内容","お問い合わせ内容","textarea",1,"",1]] };
function contactFields(type, keep){
  const plans=D.sponsors.filter(x=>x.kind==="プラン").map(x=>x.name).concat(["まだ決めていない"]);
  return CONTACT_FIELDS[type].map(([n,l,t,req,opt,wide])=>{ const v=esc((keep&&keep[n])||"");
    const lab=`<span>${esc(l)}${req?"<em>必須</em>":""}</span>`, rq=req?" required":"";
    let el;
    if(t==="textarea") el=`<textarea name="${esc(n)}" rows="${n==="内容"?6:3}"${rq} placeholder="${esc(opt||"")}">${v}</textarea>`;
    else if(t==="select"||t==="plan"){ const os=t==="plan"?plans:opt; el=`<select name="${esc(n)}"${rq}><option value="">選んでください</option>${os.map(o=>`<option${keep&&keep[n]===o?" selected":""}>${esc(o)}</option>`).join("")}</select>`; }
    else el=`<input name="${esc(n)}" type="${t}" value="${v}"${rq}${t==="email"?' autocomplete="email"':n==="お名前"?' autocomplete="name"':t==="tel"?' autocomplete="tel"':""}${t==="number"?' min="10" max="80" inputmode="numeric"':""} placeholder="${esc(opt||"")}">`;
    return `<label${wide||t==="textarea"?' class="wide"':""}>${lab}${el}</label>`; }).join("");
}
function contactBlock(kind){
  const k = kind==="スポンサー" ? "sponsor" : kind==="入団" ? "join" : "other";
  return `<div class="contact"><h3>お問い合わせ</h3><p>${esc(kind)}についてのお問い合わせは、こちらのフォームからどうぞ。</p>
    <div class="contact-btns"><a class="btn" href="#contact/${k}">お問い合わせフォーム</a></div></div>`;
}
function vContact(arg){
  const mail=(D.conf["問い合わせメール"]||"").trim(), ok=/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail);
  const sel = CONTACT_TYPES[arg] ? arg : "other";
  return `${band("CONTACT","お問い合わせ")}<div class="wrap narrow page">
    <p class="lead-s">${esc(clubName())}へのお問い合わせは、下のフォームからお送りください。内容を確認のうえ、担当者からご連絡します。</p>
    <form class="cform" id="cform" novalidate>
      <label class="wide"><span>お問い合わせの種類<em>必須</em></span><div class="ctype" id="ctype">${Object.entries(CONTACT_TYPES).map(([k,v])=>`<button type="button" data-k="${k}"${k===sel?' class="on"':""}>${esc(v.replace(/について$/,""))}</button>`).join("")}</div><input type="hidden" name="種類" value="${esc(CONTACT_TYPES[sel])}"></label>
      <div class="cfields" id="cfields">${contactFields(sel)}</div>
      <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off">
      <div class="cform-foot">${ok?`<button class="btn" type="submit">送信する</button>`:`<p class="contact-wait">お問い合わせフォームは準備中です。</p>`}<p class="cform-msg" id="cform-msg"></p></div>
    </form></div>`;
}
function bContact(){
  const f=$("cform"); if(!f) return;
  document.querySelectorAll("#ctype button").forEach(b=>b.onclick=()=>{ const keep=Object.fromEntries(new FormData(f).entries());
    document.querySelectorAll("#ctype button").forEach(x=>x.classList.toggle("on",x===b)); f.querySelector('input[name="種類"]').value=CONTACT_TYPES[b.dataset.k];
    $("cfields").innerHTML=contactFields(b.dataset.k, keep); history.replaceState(history.state,"",`#contact/${b.dataset.k}`); });
  f.onsubmit=async e=>{ e.preventDefault();
    const msg=$("cform-msg"), btn=f.querySelector("button"); const fd=new FormData(f);
    const miss=[...f.querySelectorAll("[required]")].filter(x=>!String(x.value).trim());
    if(miss.length){ msg.textContent="必須の項目を入力してください。"; msg.className="cform-msg ng"; miss[0].focus(); return; }
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(fd.get("email"))){ msg.textContent="メールアドレスを確認してください。"; msg.className="cform-msg ng"; return; }
    const data=Object.fromEntries(fd.entries()); if(data._honey) return;
    data._subject=`【${clubName()} サイト】${data["種類"]}`; data._template="table"; data._captcha="false";
    btn.disabled=true; btn.textContent="送信中…";
    try{
      const r=await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(D.conf["問い合わせメール"].trim())}`,{ method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"}, body:JSON.stringify(data) });
      const j=await r.json().catch(()=>({}));
      if(r.ok && String(j.success)!=="false"){ f.innerHTML=`<div class="cform-done"><b>送信しました</b><p>お問い合わせありがとうございます。内容を確認のうえ、ご連絡します。</p></div>`; }
      else throw new Error(j.message||"error");
    }catch(err){ console.error(err); msg.textContent="送信できませんでした。時間をおいてもう一度お試しください。"; msg.className="cform-msg ng"; btn.disabled=false; btn.textContent="送信する"; }
  };
}
function vJoin(){
  const c=D.conf, s=ST.season, r=record(leagueOf(s)), rk=myRank(s);
  const open = !/終了|停止|なし/.test(c["選手募集"]||"");
  const spec=[["募集ポジション",c["募集ポジション"]],["対象",c["募集対象"]],["練習場所",c["練習場所"]],["会費",c["会費"]]].filter(([,v])=>v);
  const msg = c["選手募集メッセージ"] || `${clubName()}では、一緒にリーグ戦を戦う選手を募集しています。まずは一度、練習に参加してみてください。`;
  return `${band("RECRUIT","選手募集")}<div class="wrap narrow page">
    <div class="lead"><span class="state ${open?"on":""}">${open?"募集中":"現在は募集していません"}</span>
      <h2>一緒にプレーする仲間を<br class="sp">探しています</h2><p>${esc(msg)}</p></div>
    ${spec.length?`<h3 class="h3">募集要項</h3><dl class="spec">${spec.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
    ${r.n?`<h3 class="h3">${esc(s)}シーズンの成績</h3><div class="facts"><div><span>リーグ順位</span><b>${rk?esc(rk):"-"}<small>位</small></b></div>
      <div><span>成績</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div><div><span>得点</span><b>${r.gf}</b></div><div><span>失点</span><b>${r.ga}</b></div></div>`:""}
    <p class="more-link"><a href="#history">チームについて詳しく見る（クラブ情報）</a></p>
    <h3 class="h3">入団までの流れ</h3>
    <ol class="flow"><li><b>お問い合わせ</b><p>下のお問い合わせ先から、名前・年齢・サッカー歴・希望ポジションを送ってください。</p></li>
      <li><b>練習に参加</b><p>まずは練習に参加して、チームの雰囲気を見てください。</p></li>
      <li><b>入団・選手登録</b><p>入団が決まったら、リーグ戦に出るための選手登録をします。</p></li></ol>
    ${contactBlock("入団")}
  </div>`;
}
function vSponsor(){
  const c=D.conf, s=ST.season, r=record(leagueOf(s)), rk=myRank(s);
  const plans=D.sponsors.filter(x=>x.kind==="プラン"), partners=D.sponsors.filter(x=>x.kind!=="プラン");
  const msg = c["スポンサー募集メッセージ"] || `${clubName()}は、姫路市で活動する社会人サッカーチームです。ユニフォームやグラウンド代、大会の参加費など、チームの活動を一緒に支えてくださる企業・お店・個人の方を募集しています。`;
  const facts=[["所属リーグ",c["所属リーグ"]],[`${s||""}シーズン`, r.n?`${rk?rk+"位　":""}${r.w}勝${r.d}分${r.l}敗`:""]].filter(([,v])=>v);
  return `${band("PARTNER","スポンサー募集")}<div class="wrap narrow page">
    <div class="lead">${/停止|終了|なし/.test(c["スポンサー募集"]||"")?`<span class="state">現在は募集していません</span>`:`<span class="state on">募集中</span>`}<h2>${esc(clubName())}を一緒に<br class="sp">支えてください</h2><p>${esc(msg)}</p></div>
    ${(()=>{ const L=philoList(); if(!L.length) return "";
      return `<section class="philo"><div class="philo-h"><span>PHILOSOPHY</span>チーム理念</div>${philoHtml(L)}</section>`; })()}
    ${facts.length?`<h3 class="h3">${esc(clubName())}について</h3><dl class="spec">${facts.map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl><p class="more-link"><a href="#history">クラブ情報を見る</a></p>`:""}
    ${(()=>{ const U=String(c["スポンサー料の使い道"]||"").split(/\r?\n|、/).map(x=>x.trim()).filter(Boolean); if(!U.length) return "";
      return `<h3 class="h3">スポンサー料の使い道</h3><p class="muted">いただいたスポンサー料は、チームの活動に大切に使わせていただきます。</p><ul class="uses">${U.map(x=>`<li>${esc(x)}</li>`).join("")}</ul>`; })()}
    ${plans.length?`<h3 class="h3">スポンサープラン</h3><div class="plans">${plans.map(x=>`<div class="plan"><b>${esc(x.name)}</b><div class="plan-p">${x.price?esc(x.price):"金額はお問い合わせください"}</div><p>${esc(x.body)}</p></div>`).join("")}</div>
      <p class="note">内容や金額はご相談に応じます。</p>`:""}
    <h3 class="h3">スポンサー企業・団体</h3>
    ${partners.length?`<div class="pt-grid">${partnerLogos(partners)}</div>`:`<p class="muted">現在、スポンサーを募集しています。</p>`}
    ${contactBlock("スポンサー")}
  </div>`;
}

/* ---------- NEWS ---------- */
function vNews(){
  const cats=["すべて","INFO","MATCH","NOTICE","PRACTICE","TM","EVENT","RECORD","MEMBER","SEASON"].filter(c=>c==="すべて"||D.news.some(n=>n.cat===c));
  const L=D.news.filter(n=>ST.newsCat==="すべて"||n.cat===ST.newsCat);
  return `${band("NEWS","ニュース")}<div class="wrap narrow">
    <div class="pill-tabs" id="nw-tabs">${cats.map(c=>`<button class="pill${c===ST.newsCat?" on":""}" data-c="${c}">${c==="すべて"?"すべて":CAT_JP[c]||c}</button>`).join("")}</div>
    ${L.length?`<div class="nls">${L.map(newsLine).join("")}</div>`:empty("まだニュースはありません。")}</div>`;
}
function bNewsDetail(){ bindShare(); }
function bNews(){ document.querySelectorAll("#nw-tabs .pill").forEach(b=>b.onclick=()=>{ ST.newsCat=b.dataset.c; render(); }); }
function vNewsDetail(id){
  const NL=D.news.filter(x=>!x.nm);
  const n=NL.find(x=>x.id===id); if(!n) return `${band("NEWS","ニュース")}<div class="wrap narrow">${empty("ニュースが見つかりません。")}</div>`;
  const i=NL.indexOf(n), nx=NL[i-1], pv=NL[i+1];
  return `${band("NEWS","ニュース")}<div class="wrap narrow">
    <div class="crumb"><a href="#home">HOME</a> › <a href="#news">NEWS</a></div>
    <article><div class="nd-head"><div class="meta"><span class="cat ${n.cat}">${esc(n.catLabel||CAT_JP[n.cat]||n.cat)}</span><span>${n.date?fmtDW(n.date):nDate(n)}</span></div><h1>${esc(n.title)}</h1></div>
      ${visual(n)}<div class="nd-body">${newsBody(n)}</div>${n.m?reportHtml(n.m):""}${shareBar(n.title)}</article>
    <div class="pager">${pv?`<a href="#news/${encodeURIComponent(pv.id)}"><small>‹ PREV</small>${esc(pv.title)}</a>`:"<span></span>"}${nx?`<a class="nx" href="#news/${encodeURIComponent(nx.id)}"><small>NEXT ›</small>${esc(nx.title)}</a>`:""}</div></div>`;
}

/* ---------- MATCH ---------- */
function vMatch(){
  const s=ST.season, L0=D.matches.filter(m=>!s || m.season===s), comps=["すべて",...new Set(L0.map(m=>m.comp))];
  if(!comps.includes(ST.comp)) ST.comp="すべて";
  const L=L0.filter(m=>ST.comp==="すべて"||m.comp===ST.comp), r=record(L.filter(m=>m.played));
  return `${band("MATCH","試合日程・結果")}<div class="wrap">
    <div class="toolbar">${seasonSel("mt-season", s)}${D.matches.some(m=>!m.played&&m.date)?`<button class="btn line" id="cal-all">今後の試合をカレンダーに追加</button>`:""}</div>
    <div class="pill-tabs" id="mt-tabs">${comps.map(c=>`<button class="pill${c===ST.comp?" on":""}" data-c="${esc(c)}">${c==="すべて"?"ALL":esc(c)}</button>`).join("")}</div>
    ${r.n?`<div class="chips"><div class="chip"><span>試合</span><b>${r.n}</b></div><div class="chip"><span>勝-分-敗</span><b>${r.w}<small>勝</small>${r.d}<small>分</small>${r.l}<small>敗</small></b></div>
      <div class="chip"><span>得点</span><b>${r.gf}</b></div><div class="chip"><span>失点</span><b>${r.ga}</b></div><div class="chip"><span>無失点</span><b>${r.cs}</b></div></div>`:""}
    ${L.length?`<div class="mlist">${L.map(m=>{ const S=sides(m);
      return `<a class="mrow" href="#match/${m.id}">
        <div class="mrow-d">${dateEN(m.date)}<span>${esc(m.comp)}<br>${esc(m.round)}</span></div>
        <div class="mrow-t r"><span>${esc(S.home)}</span>${logo(S.home)}</div>
        <div class="mrow-s">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b}-${m.pk.a}`:`${m.pk.a}-${m.pk.b}`}</small>`:""}`:`<span class="vs">VS</span>`}</div>
        <div class="mrow-t">${logo(S.away)}<span>${esc(S.away)}</span></div>
        <div class="mrow-r"><span class="ha ${m.ha}">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"N"}</span> <span class="res ${resCls(m)}">${m.played?(m.draw&&!m.pk?"D":m.res):"NEXT"}</span></div></a>`; }).join("")}</div>`
      :empty("試合はまだありません。")}</div>`;
}
function bMatch(){ bindCal(); bindSel("mt-season", v=>{ ST.season=v; render(); }); document.querySelectorAll("#mt-tabs .pill").forEach(b=>b.onclick=()=>{ ST.comp=b.dataset.c; render(); }); }

/* 試合のスタッツ。[項目, 単位, 小数, 少ないほうが良い, 計算式] */
const tv = (m,s,h) => teamVal(m,s,h);
const tTkl = (m,s) => tv(m,s,"タックル") ?? ((tv(m,s,"スタンディングタックル")!=null||tv(m,s,"スライディングタックル")!=null) ? (tv(m,s,"スタンディングタックル")||0)+(tv(m,s,"スライディングタックル")||0) : null);
const tTklW = (m,s) => tv(m,s,"タックル成功") ?? ((tv(m,s,"スタンディングタックル成功")!=null||tv(m,s,"スライディングタックル成功")!=null) ? (tv(m,s,"スタンディングタックル成功")||0)+(tv(m,s,"スライディングタックル成功")||0) : null);
const MS = [
  ["概要", [["ボール奪取時間","秒",1,1],["シュート"],["ゴール期待値","",2],["パス"],["タックル","",0,0,tTkl],["タックル成功","",0,0,tTklW],["インターセプト"],["セーブ"],
    ["ファウル","",0,1],["オフサイド","",0,1],["コーナーキック"],["フリーキック"],["PK"],["警告","",0,1],["退場","",0,1],
    ["守備ライン突破（間）"],["守備ライン突破（外）"],["守備ライン突破（上）"],["守備ライン突破の試み"]]],
  ["シュート", [["枠内シュート"],["枠外シュート"],["ブロックされたシュート"],["シュート精度","%",1,0,(m,s)=>rate(tv(m,s,"枠内シュート"),tv(m,s,"シュート"))],
    ["通常シュート"],["フィネスシュート"],["ヘディングシュート"],["パワーシュート"],["ボレーシュート"],["チップシュート"],["セットプレーのシュート"],
    ["ボックス内シュート"],["ボックス外シュート"],["ニアサイドへのシュート"],["ファーサイドへのシュート"]]],
  ["パス", [["パス成功"],["パス成功率","%",1,0,(m,s)=>rate(tv(m,s,"パス成功"),tv(m,s,"パス"))],["パスカットされた","",0,1],["オフサイドのパス","",0,1],["その他のパス"],
    ["グラウンダーパス"],["ロブパス"],["スルーパス"],["ロブスルーパス"],["クロス"],["セットプレーのパス"],
    ["キーパス"],["ダイレクトパス"],["パス&ゴー"],["サイドを使ったパス"],["ブレイクアウェイのパス"]]],
  ["守備", [["スタンディングタックル"],["スタンディングタックル成功"],["スライディングタックル"],["スライディングタックル成功"],["タックル成功率","%",1,0,(m,s)=>rate(tTklW(m,s),tTkl(m,s))],
    ["ブロック"],["クリア"],["オフェンスデュエル勝利"],["ディフェンスデュエル勝利"],["空中戦勝利"],["突破された回数","",0,1],["PK献上","",0,1]]]
];
const msVal = (m,side,it) => it[4] ? it[4](m,side) : teamVal(m,side,it[0]);
const hasStats = m => Object.keys(m.ts||{}).length>0;   /* チームスタッツの記録がある試合だけ */

function vMatchDetail(arg){
  const [id, tab]=String(arg).split("/");
  const m=D.matches.find(x=>x.id===+id); if(!m) return `${band("MATCH","試合")}<div class="wrap">${empty("試合が見つかりません。")}</div>`;
  if(tab) ST.mtab=tab;
  const S=sides(m), hasLu=m.lu.me.length||m.lu.opp.length, hasEv=m.ev.length;
  const T=[["sum","SUMMARY","概要",true],["stats","STATS","スタッツ",hasStats(m)],["lineup","LINE-UP","出場選手",hasLu],["timeline","TIMELINE","経過",hasEv]];
  if(!T.find(t=>t[0]===ST.mtab && t[3])) ST.mtab="sum";
  const goalsOf = side => side==="me" ? m.scorers.map(x=>`${esc(x.name)}${x.n>1?` ×${x.n}`:""}`)
    : m.ev.filter(e=>e.side==="opp"&&isGoal(e)).map(e=>`${esc(e.player)} ${esc(e.min)}'`)
      .concat(m.lu.opp.filter(l=>l.g&&!m.ev.some(e=>e.side==="opp"&&isGoal(e))).map(l=>`${esc(l.name)}${l.g>1?` ×${l.g}`:""}`));
  const pv=D.matches.find(x=>x.id===m.id-1), nx=D.matches.find(x=>x.id===m.id+1);
  let body="";
  if(ST.mtab==="stats") body=tabStats(m,S); else if(ST.mtab==="lineup") body=tabLineup(m,S); else if(ST.mtab==="timeline") body=tabTimeline(m,S); else body=tabSummary(m);
  return `<section class="mh"><div class="mh-in">
      <div class="mh-comp">${compRoundH(m)}</div><div class="mh-date">${m.date?`${fmtD(m.date)} ${WDE[m.date.getDay()]}`:""}　<span class="ha ${m.ha}" style="color:#fff">${m.ha==="H"?"HOME":m.ha==="A"?"AWAY":"NEUTRAL"}</span></div>
      <div class="mh-board"><div class="mh-team">${logo(S.home)}${esc(S.home)}</div>
        <div class="mh-score">${m.played?`${S.hs}-${S.as}${m.pk?`<small>PK ${m.ha==="A"?`${m.pk.b} - ${m.pk.a}`:`${m.pk.a} - ${m.pk.b}`}</small>`:""}`:`<span style="font-size:.5em;font-style:italic;opacity:.6">VS</span>`}</div>
        <div class="mh-team">${logo(S.away)}${esc(S.away)}</div></div>
      ${m.played?`<div class="mh-res"><span class="res ${resCls(m)}">${resEN(m)}</span></div>
      <div class="mh-goals"><ul class="r">${goalsOf(S.hSide).map(x=>`<li>${x}${BALL}</li>`).join("")}</ul><ul>${goalsOf(S.aSide).map(x=>`<li>${BALL}${x}</li>`).join("")}</ul></div>`:""}
    </div></section>
    ${m.played&&T.filter(t=>t[3]).length>1?`<nav class="mtabs"><div class="mtabs-in" style="grid-template-columns:repeat(${T.filter(t=>t[3]).length},1fr)">${T.filter(t=>t[3]).map(([k,en,jp])=>`<button data-t="${k}"${k===ST.mtab?' class="on"':""}>${jp}<small>${en}</small></button>`).join("")}</div></nav>`:""}
    <div class="wrap" style="max-width:1000px">
      <div class="crumb"><a href="#home">HOME</a> › <a href="#match">MATCH</a></div>
      ${m.played?body:`<div class="pre">${m.time||m.venue?`<dl class="spec">${m.time?`<div><dt>キックオフ</dt><dd>${esc(m.time)}</dd></div>`:""}${m.venue?`<div><dt>会場</dt><dd>${esc(m.venue)}</dd></div>`:""}</dl>`:""}${calBtns(m)}</div>${h2hHtml(m)}`}
      ${shareBar(m.played?`${clubName()} ${m.gf}-${m.ga} ${m.opp}（${compRound(m)}）`:`${fmtMD(m.date)} ${compRound(m)} vs ${m.opp}`)}
      <div class="pager">${pv?`<a href="#match/${pv.id}"><small>‹ PREV</small>${fmtMD(pv.date)} vs ${esc(pv.opp)}</a>`:"<span></span>"}${nx?`<a class="nx" href="#match/${nx.id}"><small>NEXT ›</small>${fmtMD(nx.date)} vs ${esc(nx.opp)}</a>`:""}</div>
    </div>`;
}
function bMatchDetail(){ bindCal(); bindShare(); document.querySelectorAll(".mtabs button").forEach(b=>b.onclick=()=>{ if(b.disabled) return; ST.mtab=b.dataset.t;
  const id=parseHash().arg.split("/")[0]; history.replaceState(history.state,"",`#match/${id}${ST.mtab==="sum"?"":"/"+ST.mtab}`); render(); });
  document.querySelectorAll("#lu-side .pill").forEach(b=>b.onclick=()=>{ ST.luSide=b.dataset.s; render(); });
  document.querySelectorAll("#lu-grp .tab").forEach(b=>b.onclick=()=>{ ST.luGrp=b.dataset.g; render(); }); }

function reportHtml(m){
  if(!m.report && !m.cCoach && !m.cPlayers) return "";
  const paras = t => String(t||"").split(/\r?\n/).filter(x=>x.trim()).map(x=>`<p>${esc(x)}</p>`).join("");
  const pc = String(m.cPlayers||"").split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>{ const mm=x.match(/^(.+?)[：:]\s*(.+)$/); return mm?{name:fullName(mm[1].trim()),t:mm[2]}:{name:"",t:x}; });
  return `<section class="report"><h2 class="pd-h">マッチレポート</h2>${m.report?`<div class="rp-body">${paras(m.report)}</div>`:""}
    ${m.cCoach?(()=>{ const co=staffOf("監督"); return `<div class="cmt coach"><${co&&co.P?`a href="#player/${pid(co.name)}"`:"div"} class="cmt-who">${face(co?co.name:"監督")}<div><small>監督</small><b>${esc(co?co.name:"")}</b></div></${co&&co.P?"a":"div"}>`; })()+`<div class="cmt-t">${paras(m.cCoach)}</div></div>`:""}
    ${pc.map(x=>`<div class="cmt">${x.name?`<a class="cmt-who" href="#player/${pid(x.name)}">${face(x.name)}<div><small>${esc((profile(x.name)||{}).pos||"選手")}</small><b>${esc(x.name)}</b></div></a>`:""}<div class="cmt-t"><p>${esc(x.t)}</p></div></div>`).join("")}</section>`;
}
function tabSummary(m){
  const none = m.gf>0 ? "記録なし" : "なし";
  const list=(L)=> L.length? `<ul>${L.map(x=>`<li><a href="#player/${pid(x.name)}">${esc(x.name)}</a>${x.n>1?` ×${x.n}`:""}</li>`).join("")}</ul>` : `<p style="color:var(--ink3);font-size:13px">${none}</p>`;
  return `<div class="box-grid">
      <div class="box"><h3>GOAL<small>得点者</small></h3>${list(m.scorers)}</div>
      <div class="box"><h3>ASSIST<small>アシスト</small></h3>${list(m.assists)}</div>
      ${m.mom?`<a class="box mom" href="#player/${pid(m.mom)}">${face(m.mom)}<div><h3 style="margin-bottom:2px">MAN OF THE MATCH</h3><b>${esc(m.mom)}</b></div></a>`:""}
      ${m.venue?`<div class="box"><h3>VENUE<small>会場</small></h3><b style="font-size:16px">${esc(m.venue)}</b></div>`:""}
      ${m.att?`<div class="box"><h3>ATTENDANCE<small>入場者数</small></h3><b class="en" style="font-size:36px;font-weight:800">${nf(m.att)}</b> 人</div>`:""}
    </div>
    ${m.memo?`<div class="memo">${esc(m.memo)}</div>`:""}
    ${reportHtml(m)}
    ${h2hHtml(m)}
    ${hasStats(m)?`<div style="margin-top:28px">${tabStats(m, sides(m), true)}</div>`:""}`;
}
function cmpRow(label, a, b, u, d, low){
  if(a==null && b==null) return "";
  const x=a||0, y=b||0, mx=Math.max(x,y,0.0001);
  const better = low ? (x<y?"h":y<x?"a":"") : (x>y?"h":y>x?"a":"");
  const pctLike = u==="%";
  const wa = pctLike ? Math.min(100,x) : x/mx*100, wb = pctLike ? Math.min(100,y) : y/mx*100;
  const f = v => v==null ? "-" : fmtV(v,d)+(u==="%"?"%":"");
  return `<div class="cmp"><div class="cmp-v${better==="h"?" win":""}">${f(a)}</div>
    <div class="cmp-m"><span>${label}${u&&u!=="%"?`（${u}）`:""}</span><div class="cmp-bar"><i><b style="width:${wa}%"></b></i><i><b style="width:${wb}%"></b></i></div></div>
    <div class="cmp-v r${better==="a"?" win":""}">${f(b)}</div></div>`;
}
function tabStats(m,S,short){
  const H=S.hSide, A=S.aSide;
  const poss=[teamVal(m,H,"ボール支配率"), teamVal(m,A,"ボール支配率")];
  const head=`<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}${m.form[H]?` <span class="form-tag">${esc(m.form[H])}</span>`:""}</div><div></div><div class="r">${m.form[A]?`<span class="form-tag">${esc(m.form[A])}</span> `:""}${esc(S.away)} ${logo(S.away)}</div></div>`;
  const posHtml = (poss[0]!=null||poss[1]!=null) ? `<div class="poss"><div class="poss-bar"><i style="width:${poss[0]??(100-(poss[1]||0))}%"><b>${fmtV(poss[0]??(100-poss[1]),0)}%</b></i><i><b>${fmtV(poss[1]??(100-poss[0]),0)}%</b></i></div><span>ボール支配率</span></div>` : "";
  const groups = short ? [MS[0]] : MS;
  const body = groups.map(([g,L])=>{ const rows=L.map(it=>cmpRow(it[0], msVal(m,H,it), msVal(m,A,it), it[1]||"", it[2]||0, it[3])).join("");
    return rows ? `<div class="sub-h">${esc(g)}</div>${rows}` : ""; }).join("");
  if(!body && !posHtml) return "";
  return `${head}${posHtml}${body}${short?`<p style="margin-top:16px"><a class="btn" href="#match/${m.id}/stats">ALL STATS ›</a></p>`:""}`;
}
/* フォーメーションに合わせて、先発11人をピッチに並べる */
function placeXI(L, form){
  const st=L.filter(l=>l.role==="先発");
  if(!st.length) return [];
  const gk=st.filter(l=>posGroup(l.pos)==="GK"), out=st.filter(l=>posGroup(l.pos)!=="GK")
    .map((l,i)=>({l,i,d:POS_DEPTH[l.pos]!=null?POS_DEPTH[l.pos]:2.5,lat:POS_LAT(l.pos)})).sort((a,b)=>a.d-b.d || a.i-b.i);
  let rows=[];
  const cnt=String(form||"").split("-").map(Number).filter(n=>n>0);
  if(cnt.length && cnt.reduce((a,b)=>a+b,0)===out.length){ let k=0; cnt.forEach(c=>{ rows.push(out.slice(k,k+c)); k+=c; }); }
  else { const g={}; out.forEach(o=>{ const b=Math.round(o.d); (g[b]=g[b]||[]).push(o); }); rows=Object.keys(g).sort().map(k=>g[k]); }
  const P=[]; gk.forEach((l,j)=>P.push({l,x:50+(j-(gk.length-1)/2)*20,y:90}));
  const n=rows.length;
  rows.forEach((row,ri)=>{ const y= n===1? 45 : 72 - ri*(58/(n-1));
    row.sort((a,b)=>a.lat-b.lat || a.i-b.i).forEach((o,j)=>P.push({l:o.l, x: 10 + 80*(j+.5)/row.length, y, w: 78/row.length})); });
  return P;
}
/* 名前を省略せず、「・」や空白のところで折り返す */
const brk = s => esc(s).replace(/([・･\s])/g,"$1<wbr>");
function pitchHtml(L, form, side, m){
  const P=placeXI(L, form);
  if(!P.length) return "";
  return `<div class="pitch"><div class="arc"></div>${P.map(({l,x,y,w})=>{
    const off = m.ev.some(e=>e.side===side&&e.kind==="交代"&&same(e.rel,l.name)) || (l.min!=null && l.min<HALF*2 && l.role==="先発");
    const ic=`${l.g?`<span class="pp-g">${"⚽".repeat(Math.min(l.g,3))}</span>`:""}${l.yc?'<i class="ico-y"></i>':""}${l.rc?'<i class="ico-r"></i>':""}`;
    /* 途中で下がった選手：赤い矢印＋交代した時間 */
    const subE = m.ev.find(e=>e.side===side&&e.kind==="交代"&&same(e.rel,l.name));
    const offMin = subE ? (subE.note==="ハーフタイム" ? "HT" : `${subE.min}'`) : (l.min!=null && l.role==="先発" && l.min<HALF*2 ? `${l.min}'` : "");
    const inner=`<div class="pp-s">${l.no??""}${off?`<span class="pp-off" title="${offMin?offMin.replace("'","分")+"に":""}交代で退いた"><b>▼</b>${esc(offMin)}</span>`:""}${ic?`<span class="pp-i">${ic}</span>`:""}</div><span class="pp-n">${brk(side==="me"?surname(l.name):l.name)}</span>`;
    return `<div class="pp ${side==="opp"?"opp":""} ${posGroup(l.pos)==="GK"?"gk":""}" style="left:${x}%;top:${y}%;width:${Math.min(24,w||24).toFixed(1)}%">${side==="me"?`<a href="#player/${pid(l.name)}">${inner}</a>`:inner}</div>`; }).join("")}</div>`;
}
/* 出場選手の表 */
const luTkl = l => l.s["タックル"] ?? ((l.s["スタンディングタックル"]!=null||l.s["スライディングタックル"]!=null) ? (l.s["スタンディングタックル"]||0)+(l.s["スライディングタックル"]||0) : null);
const LU_GRP = [
  ["概要", [["評価","",1],["出場時間","分"],["得点"],["アシスト"],["シュート"],["シュート精度","%",0,l=>rate(l.s["枠内シュート"],l.s["シュート"])],["パス"],["パス成功率","%",0,l=>rate(l.s["パス成功"],l.s["パス"])],
    ["ドリブル"],["ドリブル成功率","%",0,l=>rate(l.s["ドリブル成功"],l.s["ドリブル"])],["タックル","",0,luTkl],["オフサイド"],["ファウル"],["ボール奪取"],["ボールロスト"],["走行距離","km",1],["スプリント距離","km",2],["警告"],["退場"]]],
  ["ポゼッション", [["ボール保持率","%",1],["ドリブル成功"],["ドリブル距離","km",2],["タックルされた回数"],["獲得CK"],["被ファウル"],["獲得PK"],["ダミーからのアシスト"],
    ["抜き去り"],["スキルムーブで抜き去り"],["股抜き"],["縦への突破"]]],
  ["シュート", [["PKを除くゴール"],["PKを除くゴール期待値","",2],["枠内シュート"],["枠外シュート"],["ブロックされたシュート"],["FKゴール"],["PKゴール"],["シュートからのアシスト"],
    ["通常シュート"],["フィネスシュート"],["ヘディングシュート"],["パワーシュート"],["ボレーシュート"],["チップシュート"],["セットプレーのシュート"]]],
  ["パス", [["期待アシスト","",2],["セカンドアシスト"],["キーパス"],["パスで抜いた人数"],["パス成功"],["パスカットされた"],["オフサイドのパス"],["クロス"],["クロス成功"],["ブロックされたクロス"],
    ["プレッシャー下のパス"],["プレッシャー下のパス成功"],["グラウンダーパス"],["ロブパス"],["スルーパス"],["ロブスルーパス"],["セットプレーのパス"]]],
  ["守備", [["スタンディングタックル"],["スタンディングタックル成功"],["スライディングタックル"],["スライディングタックル成功"],["インターセプト"],["ブロック"],["クリア"],["オフサイド誘発"],
    ["オフェンスデュエル"],["オフェンスデュエル勝利"],["ディフェンスデュエル"],["ディフェンスデュエル勝利"],["空中戦"],["空中戦勝利"],["突破された回数"],["PK献上"],["オウンゴール"]]],
  ["GK", [["被シュート"],["被枠内シュート"],["セーブ"],["失点"],["セーブ率","%",0,l=>rate(l.s["セーブ"],l.s["被枠内シュート"])],["パンチング"],["飛び出してのセーブ"],["PKセーブ"],["PK失点"],
    ["通常シュートをセーブ"],["フィネスシュートをセーブ"],["ヘディングをセーブ"],["パワーシュートをセーブ"],["ボレーをセーブ"],["チップをセーブ"],["セットプレーをセーブ"]]]
];
function tabLineup(m,S){
  const col = side => { const L=m.lu[side], club= side==="me"?clubName():m.opp, form=m.form[side];
    if(!L.length) return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span></div>${empty("出場選手の記録はありません。")}</div>`;
    const subs=L.filter(l=>l.role==="途中出場"), bench=L.filter(l=>l.role==="ベンチ");
    const nm=l=> side==="me"?`<a href="#player/${pid(l.name)}">${esc(l.name)}</a>`:esc(l.name);
    const offFor = l => { const e=m.ev.find(e=>e.side===side&&e.kind==="交代"&&same(e.player,l.name)); return e ? `${esc(e.min)}' OUT ${esc(e.rel)}` : (l.min!=null?`${l.min}分`:""); };
    return `<div><div class="lu-h">${logo(club)}<span>${esc(club)}</span>${form?`<span class="form-tag">${esc(form)}</span>`:""}</div>
      ${pitchHtml(L, form, side, m)}${L.some(l=>l.role==="先発")?`<p class="pitch-key"><span><i class="k-off">▼</i>交代で退いた時間</span><span>⚽ 得点</span><span><i class="ico-y"></i> 警告</span></p>`:""}
      ${subs.length?`<div class="subs"><h4>SUBSTITUTES <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">途中出場</small></h4><ul>${subs.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}　${offFor(l)}</small></li>`).join("")}</ul></div>`:""}
      ${bench.length?`<div class="subs"><h4>BENCH <small style="font-family:'Noto Sans JP';font-size:11px;font-weight:500">ベンチ</small></h4><ul>${bench.map(l=>`<li><span class="no">${l.no??""}</span>${nm(l)}<small style="color:var(--ink3)">${esc(l.pos)}</small></li>`).join("")}</ul></div>`:""}</div>`; };
  const side=ST.luSide==="opp"?"opp":"me";
  const grps=LU_GRP.filter(([,C])=>m.lu[side].some(l=>C.some(c=>(c[3]?c[3](l):l.s[c[0]])!=null)));
  const g=grps.find(x=>x[0]===ST.luGrp)||grps[0];
  let L=m.lu[side].filter(l=>l.role!=="ベンチ");
  if(g && g[0]==="GK") L=L.filter(l=>posGroup(l.pos)==="GK");
  const cols= g ? g[1].filter(c=>L.some(l=>(c[3]?c[3](l):l.s[c[0]])!=null)) : [];
  const cell=(l,c)=>{ const v=c[3]?c[3](l):l.s[c[0]]; if(v==null) return ""; if(c[0]==="警告") return v?'<i class="ico-y"></i>':""; if(c[0]==="退場") return v?'<i class="ico-r"></i>':""; return fmtV(v,c[2]||0)+(c[1]==="%"?"%":""); };
  return `<div class="lu-grid">${col(S.hSide)}${col(S.aSide)}</div>
    <div class="sub-h">PLAYER STATS<small>選手ごとの記録</small></div>
    <div class="pill-tabs" id="lu-side"><button class="pill${side==="me"?" on":""}" data-s="me">${esc(clubName())}</button><button class="pill${side==="opp"?" on":""}" data-s="opp">${esc(m.opp)}</button></div>
    ${g?`<div class="tabs" id="lu-grp">${grps.map(([k])=>`<button class="tab${k===g[0]?" on":""}" data-g="${k}">${k}</button>`).join("")}</div>
      <div class="tw"><table class="t"><thead><tr><th class="l">名前</th><th>#</th><th>POS</th>${cols.map(c=>`<th>${c[0]}${c[1]&&c[1]!=="%"?`<br><small>${c[1]}</small>`:""}</th>`).join("")}</tr></thead><tbody>
      ${L.slice().sort((a,b)=>({"先発":0,"途中出場":1}[a.role]??2)-({"先発":0,"途中出場":1}[b.role]??2) || (POS_DEPTH[a.pos]??5)-(POS_DEPTH[b.pos]??5)).map(l=>`<tr><th class="l">${side==="me"?`<a href="#player/${pid(l.name)}">${esc(l.name)}</a>`:esc(l.name)}${l.role==="途中出場"?' <small style="color:var(--ink3)">途中</small>':""}${same(l.name,m.mom)&&side==="me"?' <span class="cat">MOM</span>':""}</th><td class="num">${l.no??""}</td><td>${esc(l.pos)}</td>${cols.map(c=>`<td class="num">${cell(l,c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`
      : ""}`;
}
function tabTimeline(m,S){
  const kcls = k => isGoal({kind:k})?"goal" : k==="警告"?"y" : k==="退場"?"r" : k==="交代"?"sub" : "";
  const ev=m.ev; let ht=false;
  const rows=[];
  ev.forEach(e=>{
    const isHT = e.note==="ハーフタイム";
    if(!ht && (e.mn>=HALF+1 || isHT) && ev.some(x=>x.mn<HALF+1 && x.note!=="ハーフタイム")){ rows.push(`<div class="tl-ht"><span>HALF TIME</span></div>`); ht=true; }
    const isHome = (e.side===S.hSide);
    const who = e.side==="me" ? (e.player?pLink(e.player):"") : (e.player?`<b>${esc(e.player)}</b>`:"");
    const sub = e.kind==="交代" ? (e.rel?`<small>OUT ${esc(e.rel)}</small>`:"") : isGoal(e) ? `<small>${[e.body, e.rel?`アシスト ${esc(e.rel)}`:""].filter(Boolean).join("・")}</small>` : "";
    const txt=`<span class="tl-k ${kcls(e.kind)}">${esc(e.kind)}</span>${who}${sub}${e.note&&!isHT?`<small>${esc(e.note)}</small>`:""}`;
    rows.push(`<div class="tl-r"><div class="tl-e me">${isHome?txt:""}</div><div class="tl-m">${isHT?"HT":esc(e.min)+"'"}</div><div class="tl-e">${isHome?"":txt}</div></div>`);
  });
  return `<div class="cmp-head"><div>${logo(S.home)} ${esc(S.home)}</div><div></div><div class="r">${esc(S.away)} ${logo(S.away)}</div></div><div class="tl">${rows.join("")}<div class="tl-ht"><span>FULL TIME</span></div></div>`;
}

/* ---------- PLAYERS ---------- */
function squad(s){
  let rows=seasonRows(s).map(r=>({...r, prof:profile(r.name)}));
  /* 選手シートにいて、まだ出場していない選手も並べる */
  const latest = !s || s===D.seasonList[0];
  D.players.forEach(p=>{ if(latest && p.no!=null && !rows.some(r=>same(r.name,p.name)) && !D.trans.some(t=>same(t.name,p.name)&&trDir(t.kind)==="out"&&(!s||t.season<=s))) rows.push({name:p.name,pos:p.pos,no:p.no,prof:p,apps:0}); });
  /* 最新シーズンは背番号を登録名簿に合わせる */
  if(latest) rows.forEach(r=>{ if(r.prof && r.prof.no!=null) r.no=r.prof.no; });
  return {rows, note:""};
}
function playerCard(r){ const P=r.prof||profile(r.name), no=r.no??(P&&P.no);
  return `<a class="pcard" href="#player/${pid(r.name)}"><div class="pic">${face(r.name)}${no!=null?`<span class="no">${no}</span>`:""}</div>
    <div class="pcard-t"><b>${esc(r.name)}</b>${P&&P.en?`<span>${esc(P.en)}</span>`:""}${(()=>{ const all=rolesOf(r.name), st=all.filter(x=>!PLAYER_ROLES.includes(x)&&!CLUB_ROLES.includes(x)), pl=all.filter(x=>PLAYER_ROLES.includes(x)||CLUB_ROLES.includes(x));
      return (pl.length||st.length)?`<span class="roles">${pl.map(x=>`<em class="role cap">${esc(x)}</em>`).join("")}${st.length?`<em class="role">${esc(st.join("・"))}兼任</em>`:""}</span>`:""; })()}</div></a>`; }
function vPlayers(){
  const s=ST.season, {rows, note}=squad(s);
  const by={}; rows.forEach(r=>{ const g=posGroup((r.prof&&r.prof.pos)||r.pos); (by[g]=by[g]||[]).push(r); });
  Object.values(by).forEach(L=>L.sort((a,b)=>(a.no??999)-(b.no??999) || a.name.localeCompare(b.name,"ja")));
  const staff=staffList();
  const card = playerCard;
  return `${band("PLAYERS / STAFF","選手・スタッフ")}<div class="squad"><div class="wrap">
    ${squadTabs("players")}
    ${D.seasonList.length>1?`<div class="toolbar">${seasonSel("pl-season", s)}</div>`:""}
    ${rows.length? GROUPS.filter(([g])=>by[g]).map(([g,en,jp])=>`<section class="pos-sec"><h2 class="pos-h"><b>${g==="OT"?"MEMBER":g}</b><small>${jp}</small></h2>
      <div class="pgrid">${by[g].map(card).join("")}</div></section>`).join("")
      : empty("選手はまだ登録されていません。")}
    ${staff.length?`<section class="pos-sec"><h2 class="pos-h"><b>STAFF</b><small>スタッフ</small></h2>
      <div class="pgrid staff-grid">${staff.map(x=>{ const no=x.P&&x.P.no;
        return `<${x.P?`a href="#player/${pid(x.name)}"`:"div"} class="pcard scard"><div class="pic">${face(x.name)}</div>
          <div class="pcard-t"><small class="srole">${esc(x.roles.join("・"))}</small><b>${esc(x.name)}</b>${x.P&&x.P.en?`<span>${esc(x.P.en)}</span>`:""}${no!=null?`<em class="role">選手兼任 #${no}</em>`:""}</div></${x.P?"a":"div"}>`; }).join("")}</div></section>`:""}
    ${note?`<p class="note">${esc(note)}</p>`:""}</div></div>`;
}
function bPlayers(){ bindSel("pl-season", v=>{ ST.season=v; render(); }); }
/* 選手のシーズン×大会ごとの出場・得点（出場選手シート → なければシーズン記録シート） */
function careerOf(name){
  const S={};
  D.lineups.filter(l=>l.side==="me" && same(l.name,name) && l.m && l.m.played && (l.role!=="ベンチ" || l.min)).forEach(l=>{
    const se=l.m.season, cp=l.m.comp; const o=((S[se]=S[se]||{})[cp]=S[se][cp]||{apps:0,g:0,a:0}); o.apps++; o.g+=l.g||0; o.a+=l.a||0; });
  D.srec.filter(r=>same(r.name,name)).forEach(r=>{ if(S[r.season]) return; const lg=leagueName(r.season)||D.conf["所属リーグ"]||"リーグ戦";
    S[r.season]={[lg]:{apps:r.apps, g:r.g||0, a:r.a}}; });
  return S;
}
/* 前所属：「クラブ名（期間）」を → や改行で区切って何個でも。例）明石南高校（2015〜2017）→ 英賀保SC（2018〜2022） */
const prevItems = P => String((P&&P.prev)||"").split(/\s*(?:→|->|⇒|\r?\n|、|，)\s*/).map(x=>x.trim()).filter(Boolean)
  .map(x=>{ const m=x.match(/^(.*?)\s*[（(]\s*([^）)]*)\s*[）)]\s*$/); return m?{club:m[1].trim(), term:m[2].trim()}:{club:x, term:""}; }).filter(x=>x.club);
const prevList = P => prevItems(P).map(x=>x.club);
/* 加入年：選手・スタッフの「加入年」→ 加入・退団の加入（一番古いもの）。どちらもなければ出さない */
function joinYearOf(name){ const P=profile(name); if(P&&P.joinY) return P.joinY;
  const t=D.trans.filter(t=>same(t.name,name)&&trDir(t.kind)==="in").map(t=>t.season||(t.date?String(t.date.getFullYear()):"")).filter(Boolean).sort();
  return t[0]||""; }
const isLeague = c => /リーグ/.test(c||"");
const ag = o => o ? `${o.apps??"-"}(${o.g??"-"})` : "-(-)";
function recTable(name, seasons, total){
  const C=careerOf(name);
  const cups=[...new Set(seasons.flatMap(se=>Object.keys(C[se]||{}).filter(c=>!isLeague(c))))];
  const row = se => { const c=C[se]||{}, lgc=Object.keys(c).find(isLeague), lg=lgc||leagueName(se)||D.conf["所属リーグ"]||"";
    return `<tr><th>${esc(se)}</th><td>${esc(clubName())}</td><td class="l">${esc(lg.replace(/姫路市社会人サッカー/,"姫路市"))}</td><td class="num">${ag(lgc?c[lgc]:null)}</td>${cups.map(cp=>`<td class="num">${ag(c[cp])}</td>`).join("")}</tr>`; };
  let tot="";
  if(total){ const T={lg:{apps:0,g:0},cp:{}}; let any=false;
    Object.keys(C).forEach(se=>Object.keys(C[se]).forEach(cp=>{ const o=C[se][cp]; any=true; const t=isLeague(cp)?T.lg:(T.cp[cp]=T.cp[cp]||{apps:0,g:0}); t.apps+=o.apps||0; t.g+=o.g||0; }));
    tot=`<tr class="tot"><th colspan="3">TOTAL</th><td class="num">${any?ag(T.lg):"-(-)"}</td>${cups.map(cp=>`<td class="num">${ag(T.cp[cp])}</td>`).join("")}</tr>`; }
  return `<div class="tw"><table class="t rec"><thead><tr><th>シーズン</th><th>所属チーム</th><th class="l">リーグ</th><th>リーグ戦</th>${cups.map(c=>`<th>${esc(c.replace(/^\d{4}年度?/,""))}</th>`).join("")}</tr></thead>
    <tbody>${seasons.map(row).join("")}${tot}</tbody></table></div>`;
}
/* チーム初出場・初得点・初アシスト */
function firstOf(name, kind){
  const L=D.lineups.filter(l=>l.side==="me" && same(l.name,name) && l.m && l.m.played && (l.role!=="ベンチ" || l.min)).sort((a,b)=>(a.m.date-b.m.date)||(a.m.id-b.m.id));
  let l=null, ev=null;
  if(kind==="app") l=L[0];
  if(kind==="goal"){ l=L.find(x=>x.g>0); if(!l){ const m=D.played.find(m=>m.scorers.some(x=>same(x.name,name))); if(m) l={m,role:"",min:null}; } }
  if(kind==="ast"){ l=L.find(x=>x.a>0); if(!l){ const m=D.played.find(m=>m.assists.some(x=>same(x.name,name))); if(m) l={m,role:"",min:null}; } }
  if(!l) return null;
  const m=l.m;
  if(kind!=="app") ev=m.ev.find(e=>e.side==="me" && (kind==="goal" ? isGoal(e)&&same(e.player,name) : isGoal(e)&&same(e.rel,name)));
  const mark = m.draw && !m.pk ? "△" : m.res==="W" ? "○" : "●";
  const half_ = mn => mn<=HALF ? `前半${Math.floor(mn)}分` : `後半${Math.floor(mn)-HALF}分`;
  let note="";
  if(kind==="app"){ const full=m.ev.length? !m.ev.some(e=>e.side==="me"&&e.kind==="交代"&&(same(e.rel,name)||same(e.player,name))) : l.min===HALF*2;
    note = l.role==="先発" ? (full||l.min===HALF*2 ? "先発フル出場" : l.min!=null ? `先発・${l.min}分出場` : "先発出場")
         : l.role==="途中出場" ? `途中出場${l.min!=null?`（${l.min}分）`:""}` : ""; }
  else if(ev) note=half_(ev.mn);
  return `<span class="d">${fmtD(m.date)}</span><span>${esc(compRound(m).replace(/姫路市社会人サッカー/,"姫路市"))} vs. ${esc(m.opp)}</span>
    <span>（${mark} ${m.gf}-${m.ga} ${m.venue?`@${esc(m.venue)}`:""}）</span>${note?`<small>${esc(note)}</small>`:""}<a class="lk" href="#match/${m.id}">試合結果 ›</a>`;
}
function vPlayerDetail(arg){
  const [idPart, tab]=String(arg).split("/");
  const name=nameFromPid(idPart);
  const P=profile(name), L=seasonsOfPlayer(name), last=L[L.length-1];
  const log=D.lineups.filter(l=>l.side==="me" && same(l.name,name) && l.m && l.m.played).sort((a,b)=>a.m.id-b.m.id);
  const mg=D.played.filter(m=>m.scorers.some(x=>same(x.name,name)) || m.assists.some(x=>same(x.name,name)) || same(m.mom,name));
  const T=D.trans.filter(t=>same(t.name,name));
  if(!P && !L.length && !mg.length && !T.length && !log.length) return `${band("PLAYERS / STAFF","選手・スタッフ")}<div class="wrap">${empty("選手が見つかりません。")}</div>`;
  const pos=(P&&P.pos)||(last&&last.pos)||"";
  const no=P&&P.no!=null ? P.no : last&&last.no!=null ? last.no : null;
  const isGK=posGroup(pos)==="GK";
  const cur=ST.season||D.seasonList[0]||"";
  const prof=[["生年月日",P&&P.birth?`${P.birth.getFullYear()}年${P.birth.getMonth()+1}月${P.birth.getDate()}日（${ageAt(P.birth,cur)}歳）`:P&&P.birthS],
    ["身長",P&&P.height?`${P.height}cm`:""],["出身地",P&&P.nat],["利き足",P&&P.foot],["前所属",prevList(P).slice(-1)[0]],["加入",(y=>y?`${y}年${parseInt(cur,10)>=+y?`（${parseInt(cur,10)-y+1}年目）`:""}`:"")(joinYearOf(name))]].filter(([,v])=>v!=null&&v!=="");
  const stats = tab==="stats";
  /* 昨シーズンまで：記録があるシーズン＋前のシーズン（記録がなくても -(-) で出す） */
  const C=careerOf(name), prevY=String((parseInt(cur,10)||0)-1);
  const past=[...new Set([...Object.keys(C).filter(se=>se<cur), ...(parseInt(cur,10)?[prevY]:[])])].sort();
  const firsts=[["チームデビュー","app"],["チーム初得点","goal"],["チーム初アシスト","ast"]].map(([k,kind])=>{
    const manual=P&&P.first&&P.first[kind]; return [k, manual?esc(manual):(firstOf(name,kind)||"-")]; });
  const joinY=joinYearOf(name);
  const clubs=[...prevItems(P), {club:clubName(), term:joinY?`${joinY}〜`:"", now:1}];
  const hist=(prevItems(P).length||joinY)?`<ol class="clubs">${clubs.map(x=>`<li${x.now?' class="now"':""}><span class="term">${esc(x.term)}</span><span class="club">${esc(x.club)}</span></li>`).join("")}</ol>`:"";
  let body="";
  if(!stats){
    body=`${prof.length?`<dl class="pd-prof">${prof.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>`:""}
      ${P&&P.memo?`<p class="pd-memo">${esc(P.memo)}</p>`:""}
      <h2 class="pd-h">${esc(cur)}シーズン 出場・得点記録</h2>${recTable(name,[cur],false)}
      <h2 class="pd-h">昨シーズンまでの出場・得点記録</h2>${recTable(name,past,true)}
      <h2 class="pd-h">経歴</h2>
      <div class="tw"><table class="t career"><thead><tr><th>項目</th><th class="l">内容</th></tr></thead><tbody>
        ${firsts.map(([k,v])=>`<tr><th>${k}</th><td class="l">${v}</td></tr>`).join("")}
        ${hist?`<tr><th>チーム歴</th><td class="l">${hist}</td></tr>`:""}</tbody></table></div>
      ${T.length?`<h2 class="pd-h">加入・退団</h2><div class="tr-list">${T.map(trRow).join("")}</div>`:""}`;
  } else {
    const seasons=L.map(r=>r.season);
    const ps = ST.pSeason!=null && (ST.pSeason==="" || seasons.includes(ST.pSeason)) ? ST.pSeason : (last?last.season:"");
    const Tt = ps ? L.find(r=>r.season===ps) : luAgg("").find(r=>same(r.name,name));
    const groups = Tt ? PM.filter(([g])=> g!=="GK" || isGK).map(([g,Ls])=>{
      const items=Ls.map(x=>({k:x[0],f:x[1],u:x[2]||"",d:x[3]||0,avg:!!x[4]})).filter(M=>{ const v=M.f(Tt); return v!=null && (v!==0 || ["得点","アシスト","出場試合数"].includes(M.k)); });
      if(!items.length) return "";
      return `<div class="pstat"><h3>${esc(g)}</h3><dl>${items.map(M=>{ const v=M.f(Tt), a=M.avg?avgOf(Tt,M):null;
        return `<div><dt>${esc(M.k)}</dt><dd>${fmtV(v,M.d)}<small>${esc(M.u)}</small>${a!=null&&Tt.apps>1?`<em>1試合平均 ${fmtV(a, M.d||1)}</em>`:""}</dd></div>`; }).join("")}</dl></div>`; }).join("") : "";
    body=`${L.length?`<div class="toolbar"><select class="sel" id="pd-season">${L.slice().reverse().map(r=>`<option value="${esc(r.season)}"${r.season===ps?" selected":""}>${esc(r.season)}シーズン</option>`).join("")}${L.length>1?`<option value=""${ps===""?" selected":""}>通算</option>`:""}</select></div>
        <div class="pstats">${groups}</div>` : empty("記録はありません。")}
      ${log.length?`<h2 class="pd-h">出場試合</h2><div class="tw"><table class="t"><thead><tr><th>日付</th><th>大会</th><th class="l">対戦相手</th><th>結果</th><th>出場</th><th>出場時間</th><th>得点</th><th>アシスト</th>${isGK?"<th>失点</th>":""}<th>警告</th></tr></thead><tbody>
        ${log.slice().reverse().map(l=>`<tr><td class="num">${fmtD(l.m.date).slice(5)}</td><td>${esc(l.m.round||"")}</td><td class="l"><a href="#match/${l.m.id}/lineup"><div class="t-club">${logo(l.m.opp)}${esc(l.m.opp)}</div></a></td>
          <td><span class="res ${resCls(l.m)}">${l.m.gf}-${l.m.ga}</span></td><td>${l.role==="先発"?"先発":l.role==="途中出場"?"途中":"ベンチ"}</td><td class="num">${l.min??"-"}</td>
          <td class="num">${l.g||"-"}</td><td class="num">${l.a||"-"}</td>${isGK?`<td class="num">${l.role!=="ベンチ"?l.m.ga:"-"}</td>`:""}<td>${l.yc?'<i class="ico-y"></i>':""}${l.rc?'<i class="ico-r"></i>':""}</td></tr>`).join("")}</tbody></table></div>`:""}`;
  }
  return `<section class="pd"><div class="pd-in">
      <div class="pd-pic">${face(name)}</div>
      <div class="pd-main">
        <div class="pd-line">${no!=null?`<span class="pd-no">${no}</span>`:""}${pos?`<span class="pd-pos">${esc(pos)}</span>`:""}${rolesOf(name).map(x=>`<span class="pd-role">${x}</span>`).join("")}</div>
        ${P&&P.en?`<div class="pd-en">${esc(P.en)}</div>`:""}
        <h1 class="pd-name">${esc(name)}</h1>
        ${P&&P.kana?`<div class="pd-kana">${esc(P.kana)}</div>`:""}
      </div></div>
      <div class="pd-tabs"><a href="#player/${pid(name)}"${stats?"":' class="on"'}>プロフィール</a><a href="#player/${pid(name)}/stats"${stats?' class="on"':""}>スタッツ</a></div>
    </section>
    <div class="wrap pd-body">
      <div class="crumb"><a href="#home">HOME</a> / <a href="#players">選手・スタッフ</a> / ${esc(name)}</div>
      ${body}
      ${(()=>{ const sq=squad(ST.season).rows.slice().sort((a,b)=>(a.no??999)-(b.no??999)); const i=sq.findIndex(r=>same(r.name,name)); if(i<0) return "";
        const pv=sq[i-1], nx=sq[i+1];
        return `<div class="pager">${pv?`<a href="#player/${pid(pv.name)}"><small>‹ PREV</small>${pv.no??""} ${esc(pv.name)}</a>`:"<span></span>"}${nx?`<a class="nx" href="#player/${pid(nx.name)}"><small>NEXT ›</small>${nx.no??""} ${esc(nx.name)}</a>`:""}</div>`; })()}
    </div>`;
}
function bPlayerDetail(){ bindSel("pd-season", v=>{ ST.pSeason=v; render(); }); }

/* ---------- STATS（ランキング） ---------- */
/* チームの指標：[項目, 計算, 単位, 小数, 1試合平均も] （m=試合の配列、me/op=自分/相手の値の合計） */
function teamTot(L, side, h){ const v=L.map(m=>teamVal(m,side,h)).filter(x=>x!=null); return v.length ? {s:v.reduce((a,b)=>a+b,0), n:v.length} : null; }
function teamMetrics(L){
  const me=h=>teamTot(L,"me",h), op=h=>teamTot(L,"opp",h), r=record(L);
  const out=[];
  const add=(g,k,tot,u,d,avg)=>{ if(tot==null) return; out.push({g,k,v:tot.s!=null?tot.s:tot, n:tot.n, u, d, avg}); };
  const pct=(g,k,a,b)=>{ if(a&&b&&b.s) out.push({g,k,v:a.s/b.s*100,u:"%",d:1}); };
  const val=(x)=> x ? x : null;
  const po=me("ボール支配率"); if(po) out.push({g:"概要",k:"平均ボール支配率",v:po.s/po.n,u:"%",d:1});
  const rt=me("ボール奪取時間"); if(rt) out.push({g:"概要",k:"平均ボール奪取時間",v:rt.s/rt.n,u:"秒",d:1});
  add("概要","得点",{s:r.gf,n:r.n},"点",0,1); add("概要","失点",{s:r.ga,n:r.n},"点",0,1); out.push({g:"概要",k:"クリーンシート",v:r.cs,u:"試合"});
  add("概要","ゴール期待値",val(me("ゴール期待値")),"",2,1); add("概要","被ゴール期待値",val(op("ゴール期待値")),"",2,1);
  const xg=me("ゴール期待値"); if(xg) out.push({g:"概要",k:"得点とゴール期待値の差",v:r.gf-xg.s,u:"",d:2});
  ["コーナーキック","フリーキック","PK","オフサイド","ファウル"].forEach(h=>add("概要",h,val(me(h)),/キック|PK/.test(h)?"本":"回",0,1));
  add("概要","警告",val(me("警告")),"枚"); add("概要","退場",val(me("退場")),"回");
  ["守備ライン突破（間）","守備ライン突破（外）","守備ライン突破（上）","守備ライン突破の試み"].forEach(h=>add("概要",h,val(me(h)),"回",0,1));
  const sh=me("シュート"), on=me("枠内シュート");
  add("シュート","シュート",val(sh),"本",0,1); add("シュート","被シュート",val(op("シュート")),"本",0,1);
  add("シュート","枠内シュート",val(on),"本",0,1); pct("シュート","シュート精度",on,sh);
  if(sh&&sh.s) out.push({g:"シュート",k:"シュート決定率",v:r.gf/sh.s*100,u:"%",d:1});
  ["枠外シュート","ブロックされたシュート","ボックス内シュート","ボックス外シュート","ニアサイドへのシュート","ファーサイドへのシュート",
   "通常シュート","フィネスシュート","ヘディングシュート","パワーシュート","ボレーシュート","チップシュート","セットプレーのシュート"].forEach(h=>add("シュート",h,val(me(h)),"本",0,1));
  const ps=me("パス"), pc=me("パス成功");
  add("パス","パス",val(ps),"本",0,1); add("パス","パス成功",val(pc),"本",0,1); pct("パス","パス成功率",pc,ps);
  ["パスカットされた","オフサイドのパス","グラウンダーパス","ロブパス","スルーパス","ロブスルーパス","クロス","セットプレーのパス",
   "キーパス","ダイレクトパス","パス&ゴー","サイドを使ったパス","ブレイクアウェイのパス"].forEach(h=>add("パス",h,val(me(h)),"本",0,1));
  const tk=me("タックル"), tw=me("タックル成功");
  add("守備","タックル",val(tk),"回",0,1); pct("守備","タックル成功率",tw,tk);
  const st=me("スタンディングタックル"), stw=me("スタンディングタックル成功"), sl=me("スライディングタックル"), slw=me("スライディングタックル成功");
  add("守備","スタンディングタックル",val(st),"回",0,1); pct("守備","スタンディングタックル成功率",stw,st);
  add("守備","スライディングタックル",val(sl),"回",0,1); pct("守備","スライディングタックル成功率",slw,sl);
  ["インターセプト","ブロック","クリア","セーブ","オフェンスデュエル勝利","ディフェンスデュエル勝利","空中戦勝利","突破された回数","PK献上"].forEach(h=>add("守備",h,val(me(h)),"回",0,1));
  return out;

}
function vStats(){
  const s=ST.stSeason;
  const rows=statRowsFor(s);
  const fm=fromMatches(s); const mm={}; fm.forEach(x=>mm[nameKey(x.name)]=x.mom);
  rows.forEach(r=>{ if(r.mom==null) r.mom=mm[nameKey(r.name)]||0; });
  const avail=PM_ALL.filter(M=>rows.some(r=>{ const v=M.f(r); return v!=null && v!==0; }));
  if(!avail.find(M=>M.k===ST.rk)) ST.rk=(avail.find(M=>M.k==="得点")||avail[0]||{k:"得点"}).k;
  const M=PM_ALL.find(x=>x.k===ST.rk) || PM_ALL.find(x=>x.k==="得点");
  let R=rows.map(r=>({r, v:M.f(r)})).filter(x=>x.v!=null && x.v!==0);
  if(M.base){ const mx=Math.max(0,...rows.map(r=>M.base(r)||0)); const need=Math.max(1, Math.round(mx*0.3)); R=R.filter(x=>(M.base(x.r)||0)>=need); }
  R.sort((a,b)=>b.v-a.v); R=R.slice(0,20);
  const L=ofSeason(s||null), TM=teamMetrics(L), tg={}; TM.forEach(x=>(tg[x.g]=tg[x.g]||[]).push(x));
  const quick=["得点","アシスト","平均評価","シュート","キーパス","ボール奪取","走行距離"].filter(k=>avail.some(a=>a.k===k));
  return `${band("STATS","記録・ランキング")}<div class="wrap" style="max-width:1000px">
    <div class="toolbar">${seasonSel("st-season", s, true)}</div>
    <div class="sub-h" style="margin-top:0">PLAYERS<small>選手ランキング</small></div>
    ${avail.length?`<div class="pill-tabs" id="st-quick">${quick.map(k=>`<button class="pill${k===M.k?" on":""}" data-k="${esc(k)}">${esc(k)}</button>`).join("")}</div>
      <div class="toolbar"><select class="sel" id="st-item" aria-label="項目を選ぶ">${PM.map(([g,Ls])=>{ const o=Ls.filter(x=>avail.some(a=>a.k===x[0])); return o.length?`<optgroup label="${esc(g)}">${o.map(x=>`<option${x[0]===M.k?" selected":""}>${esc(x[0])}</option>`).join("")}</optgroup>`:""; }).join("")}</select></div>
      <div class="rk">${R.map((x,i)=>`<a class="rk-r" href="#player/${pid(x.r.name)}"><div class="rk-n">${i+1}</div>${face(x.r.name)}
        <div><b>${esc(x.r.name)}</b><small>${esc((profile(x.r.name)||{}).pos||x.r.pos||"")}${x.r.apps?`・${x.r.apps}試合`:""}</small></div>
        <div class="rk-v">${fmtV(x.v,M.d)}<small>${esc(M.u)}</small></div></a>`).join("")||empty("該当する選手がいません。")}</div>`
      : empty("記録はありません。")}
    ${L.length?`<div class="sub-h">TEAM<small>チームスタッツ</small></div>
      <div class="chips"><div class="chip"><span>試合</span><b>${L.length}</b></div><div class="chip"><span>勝-分-敗</span><b>${record(L).w}<small>勝</small>${record(L).d}<small>分</small>${record(L).l}<small>敗</small></b></div></div>
      ${Object.keys(tg).map(g=>`<div class="tw" style="margin-bottom:14px"><table class="t"><thead><tr><th class="l">${esc(g)}</th><th>合計</th><th>1試合平均</th></tr></thead><tbody>
        ${tg[g].map(x=>`<tr><th class="l">${esc(x.k)}</th><td class="num">${fmtV(x.v,x.d)}<small> ${esc(x.u)}</small></td><td class="num">${x.avg&&x.n?fmtV(x.v/x.n, Math.max(1,x.d)):""}</td></tr>`).join("")}</tbody></table></div>`).join("")}`:""}</div>`;
}
function bStats(){ bindSel("st-season", v=>{ ST.stSeason=v; render(); }); bindSel("st-item", v=>{ ST.rk=v; render(); });
  document.querySelectorAll("#st-quick .pill").forEach(b=>b.onclick=()=>{ ST.rk=b.dataset.k; render(); }); }

/* ---------- 加入・退団 ---------- */
function trRow(t){
  const dir=trDir(t.kind);
  return `<div class="tr">${face(t.name)}
    <div style="min-width:0"><span class="tr-k ${dir}">${esc(t.kind)}</span><a href="#player/${pid(t.name)}"><b>${esc(t.name)}</b></a>
      <div class="tr-c">${t.club?`${dir==="out"?"→":"←"} ${logo(t.club)}<span>${esc(t.club)}</span>`:""}<span class="en" style="color:var(--ink3);font-weight:600">${fmtD(t.date)}</span></div>
      ${t.memo?`<div class="tr-c">${esc(t.memo)}</div>`:""}</div>
    <div class="tr-f"><small>${esc(t.season)}</small></div></div>`;
}
function vTransfer(){
  const seasons=[...new Set(D.trans.map(t=>t.season).filter(Boolean))].sort().reverse();
  const s = ST.trSeason && seasons.includes(ST.trSeason) ? ST.trSeason : (seasons[0]||"");
  const T=D.trans.filter(t=>!s||t.season===s).sort((a,b)=>(b.date?b.date:0)-(a.date?a.date:0));
  const In=T.filter(t=>trDir(t.kind)==="in"), Out=T.filter(t=>trDir(t.kind)==="out"), Etc=T.filter(t=>trDir(t.kind)==="etc");
  return `${band("TRANSFER","加入・退団")}<div class="wrap narrow">
    ${squadTabs("transfer")}
    ${seasons.length>1?`<div class="toolbar"><select class="sel" id="tr-season">${seasons.map(x=>`<option${x===s?" selected":""}>${esc(x)}</option>`).join("")}</select></div>`:""}
    ${T.length?`${In.length?`<h2 class="pd-h">加入</h2><div class="tr-list">${In.map(trRow).join("")}</div>`:""}
      ${Out.length?`<h2 class="pd-h">退団</h2><div class="tr-list">${Out.map(trRow).join("")}</div>`:""}
      ${Etc.length?`<h2 class="pd-h">契約更新など</h2><div class="tr-list">${Etc.map(trRow).join("")}</div>`:""}`
      : empty("加入・退団のお知らせはまだありません。")}</div>`;
}
const squadTabs = cur => `<div class="sq-tabs"><a href="#players"${cur==="players"?' class="on"':""}>選手・スタッフ</a><a href="#transfer"${cur==="transfer"?' class="on"':""}>加入・退団</a></div>`;
function bTransfer(){ bindSel("tr-season", v=>{ ST.trSeason=v; render(); }); }

/* ---------- 順位表 ---------- */
function vTable(){
  const tSeasons=[...new Set(D.table.map(r=>r.season))].sort().reverse();
  const ts=ST.tblSeason && tSeasons.includes(ST.tblSeason) ? ST.tblSeason : tSeasons[0];
  const comps=[...new Set(D.table.filter(r=>r.season===ts).map(r=>r.comp))];
  const tc= comps.includes(ST.tblComp) ? ST.tblComp : comps[0];
  const live = D.matches.some(m=>m.season===ts && !m.played && (!tc || m.comp===tc));
  const lastPlayed = D.played.filter(m=>m.season===ts && (!tc||m.comp===tc)).pop();
  return `${band("STANDINGS","順位表")}<div class="wrap" style="max-width:1000px">
    ${ts?`<div class="toolbar">${tSeasons.length>1?`<select class="sel" id="hs-season">${tSeasons.map(x=>`<option${x===ts?" selected":""}>${esc(x)}シーズン</option>`).join("")}</select>`:""}
      ${comps.length>1?`<select class="sel" id="hs-comp">${comps.map(x=>`<option${x===tc?" selected":""}>${esc(x)}</option>`).join("")}</select>`:""}</div>
      <h2 class="tbl-h">${esc(ts)} ${esc(tc||"")}${live&&lastPlayed?`<small>${esc(lastPlayed.round||"")}終了時点</small>`:""}</h2>
      ${standing(ts, tc)}`:empty("順位表はまだありません。")}</div>`;
}
function bTable(){ bindSel("hs-season", v=>{ ST.tblSeason=v.replace(/シーズン$/,""); ST.tblComp=null; render(); }); bindSel("hs-comp", v=>{ ST.tblComp=v; render(); }); }

/* ---------- CLUB（歴史・順位表） ---------- */
function standing(season, comp, mini){
  const seasons=[...new Set(D.table.map(r=>r.season))].sort().reverse();
  const ts= season && seasons.includes(season) ? season : seasons[0];
  if(!ts) return "";
  const comps=[...new Set(D.table.filter(r=>r.season===ts).map(r=>r.comp))];
  const tc= comps.includes(comp) ? comp : comps[0];
  let tb=D.table.filter(r=>r.season===ts && r.comp===tc).sort((a,b)=>(a.rank||99)-(b.rank||99));
  if(mini){ const i=tb.findIndex(r=>isMe(r.club)); const a=Math.max(0, Math.min((i<0?0:i)-2, tb.length-5)); tb=tb.slice(a, a+5); }
  return `${mini?`<p style="font-size:12px;color:var(--ink2);margin:-8px 0 10px;font-weight:700">${esc(ts)} ${esc(tc)}</p>`:""}
    <div class="tw"><table class="t${mini?" mini":""}"><thead><tr><th>順位</th><th class="l">クラブ</th><th>試合</th>${mini?"":"<th>勝</th><th>分</th><th>負</th><th>得点</th><th>失点</th>"}<th>得失点</th><th>勝点</th></tr></thead><tbody>
    ${tb.map(r=>{ const me=isMe(r.club), nm=me?clubName():r.club; return `<tr class="${me?"me":""}"><th class="num">${r.rank??""}</th><td class="l"><div class="t-club">${logo(nm)}<span>${esc(nm)}</span></div></td>
      <td class="num">${r.p??""}</td>${mini?"":`<td class="num">${r.w??""}</td><td class="num">${r.d??""}</td><td class="num">${r.l??""}</td><td class="num">${r.gf??""}</td><td class="num">${r.ga??""}</td>`}
      <td class="num">${r.gf!=null&&r.ga!=null?(r.gf-r.ga>0?"+":"")+(r.gf-r.ga):""}</td><td class="num"><b>${r.pts??""}</b></td></tr>`; }).join("")}</tbody></table></div>`;
}
/* ユニフォームの文字（例「1st 赤・赤・赤／2nd 白・赤・白（GK 緑／黄）」）を色に */
const KIT_COLOR = { 赤:"#d7001c", 白:"#ffffff", 黒:"#141414", 青:"#1f4fbf", 紺:"#1b2a4a", 緑:"#1f8a4c", 黄:"#f5c400", 黄色:"#f5c400", 水色:"#6cc4ea",
  オレンジ:"#f08a00", 橙:"#f08a00", ピンク:"#f29ab8", 紫:"#6b3fa0", グレー:"#9a9a9a", 灰:"#9a9a9a", 銀:"#c0c0c0", 金:"#c9a24a", 黄緑:"#8cc63f", エンジ:"#8a1c2b" };
function parseKits(t){
  const out=[]; let lab="";
  String(t||"").replace(/[（(]/g,"／").replace(/[）)]/g,"").split(/[／\/]/).map(x=>x.trim()).filter(Boolean).forEach(seg=>{
    const m=seg.match(/^(1st|2nd|3rd|FP|GK|ホーム|アウェイ)?\s*(.*)$/i); if(m[1]) lab=m[1];
    const cols=m[2].split(/[・,、\s]+/).filter(Boolean);
    if(cols.length) out.push({ lab: m[1]||lab||"", cols });
  });
  const cnt={}; out.forEach(k=>cnt[k.lab]=(cnt[k.lab]||0)+1); const seen={};
  out.forEach(k=>{ if(cnt[k.lab]>1){ seen[k.lab]=(seen[k.lab]||0)+1; k.lab=`${k.lab} (${seen[k.lab]})`; } });
  return out;
}
function kitSvg(cols){
  const c=i=>KIT_COLOR[cols[i]]||"none", st=i=>cols[i]?"#c8c8c8":"#d8d8d8", dash=i=>cols[i]?"":' stroke-dasharray="3 3"';
  return `<svg viewBox="0 0 120 150" class="kit-svg" aria-hidden="true">
    <path d="M38 8 L22 14 L4 34 L18 48 L28 40 L28 78 L92 78 L92 40 L102 48 L116 34 L98 14 L82 8 Q60 22 38 8Z" fill="${c(0)}" stroke="${st(0)}" stroke-width="1.5"${dash(0)}/>
    <path d="M32 82 L88 82 L92 112 L64 112 L60 98 L56 112 L28 112Z" fill="${c(1)}" stroke="${st(1)}" stroke-width="1.5"${dash(1)}/>
    <path d="M34 116 L50 116 L50 146 L34 146Z M70 116 L86 116 L86 146 L70 146Z" fill="${c(2)}" stroke="${st(2)}" stroke-width="1.5"${dash(2)}/></svg>`;
}
/* チーム理念：1行に1つ。「理念：説明」と書くと説明つき */
const philoList = () => String(D.conf["チーム理念"]||"").split(/\r?\n|／/).map(x=>x.trim()).filter(Boolean).map(x=>{ const m=x.match(/^(.+?)[：:]\s*(.+)$/); return m?{t:m[1].trim(),d:m[2].trim()}:{t:x,d:""}; });
const philoHtml = L => `<ol class="philo-list">${L.map((x,i)=>`<li><b>${String(i+1).padStart(2,"0")}</b><div><p>${esc(x.t)}</p>${x.d?`<span>${esc(x.d)}</span>`:""}</div></li>`).join("")}</ol>`;
const clubSec = (id, en, jp) => `<div class="cs-h" id="${id}"><span>${en}</span><h2>${jp}</h2></div>`;
function vHistory(){
  const c=D.conf;
  const titles=[]; D.seasons.forEach(S=>{ if(/^1$/.test(S.rank)) titles.push([S.league||"リーグ",S.season]);
    [["市民大会",S.cup],["播州大会",S.lcup],["その他の大会",S.intl]].forEach(([k,v])=>{ if(/^優勝/.test(v||"")) titles.push([k,S.season]); });
    String(S.cups||"").split(/[／\/、\n]/).forEach(x=>{ const m=x.trim().match(/^(.+?)\s*優勝$/); if(m) titles.push([m[1],S.season]); }); });
  const tc={}; titles.forEach(([k,se])=>(tc[k]=tc[k]||[]).push(se));
  const prof=[["クラブ名",clubName()],["設立",c["設立"]],["代表",clubRoleHolder("代表")],["所属リーグ",c["所属リーグ"]],["練習場所",c["練習場所"]],["選手の年代",c["メンバー"]]].filter(([,v])=>v);
  const philo=philoList();
  const hy={}; D.hist.forEach(h=>(hy[h.y]=hy[h.y]||[]).push(h.t));
  const allS=[...new Set([...D.seasons.map(S=>S.season), ...D.seasonList])].sort().reverse();
  const recOf = se => { const r=record(leagueOf(se)); if(r.n) return r; const S=seasonInfo(se); if(S && S.rec[0]!=null) return {n:1,w:S.rec[0],d:S.rec[1]||0,l:S.rec[2]||0,gf:S.rec[3],ga:S.rec[4]}; return null; };
  const topScorer = se => { const L=luAgg(se).filter(r=>r.g>0); const R=(L.length?L:D.srec.filter(r=>r.season===se&&r.g>0)).slice().sort((a,b)=>b.g-a.g);
    if(!R.length) return ""; const mx=R[0].g; return R.filter(r=>r.g===mx).map(r=>esc(r.name)).join("、")+`（${mx}点）`; };
  /* カップ戦：出る大会はカテゴリーで変わるので、入っているものをまとめて1列に */
  const cupOf = S => [["",S.cups],["市民大会",S.cup],["播州大会",S.lcup],["",S.intl]].filter(([,v])=>v).map(([k,v])=>k?`${k} ${v}`:v).join("／");
  const hasCup = D.seasons.some(S=>cupOf(S));
  const nav=[["c-profile","クラブ概要",1],["c-philo","チーム理念",philo.length],["c-history","沿革",D.hist.length],["c-titles","タイトル",Object.keys(tc).length],["c-records","歴代成績",allS.length]].filter(x=>x[2]);
  const cur=ST.season, r=record(leagueOf(cur)), rk=myRank(cur);
  return `<section class="club-hero"><div class="ch-in">
      ${logo(clubName(),"ch-logo")}
      <div><span class="ch-en">${esc(clubEn())}</span><h1>${esc(clubName())}</h1>
        <p>${esc(c["所属リーグ"]||"")}${rk&&r.n?`<br>${esc(cur)}シーズン ${esc(rk)}位（${r.w}勝${r.d}分${r.l}敗）`:""}</p></div>
    </div></section>
    <nav class="club-nav"><div class="cn-in">${nav.map(([id,t])=>`<button data-to="${id}">${t}</button>`).join("")}</div></nav>
    <div class="wrap club">
    ${clubSec("c-profile","PROFILE","クラブ概要")}
    <dl class="spec">${prof.map(([k,v])=>`<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>

    ${philo.length?`${clubSec("c-philo","PHILOSOPHY","チーム理念")}${philoHtml(philo)}`:""}
    <p class="more-link"><a href="#players">選手・スタッフを見る</a></p>

    ${D.hist.length?`${clubSec("c-history","HISTORY","沿革")}<ol class="hist">${Object.keys(hy).sort().map(y=>`<li><b>${esc(y)}</b><ul>${hy[y].map(t=>`<li>${esc(t)}</li>`).join("")}</ul></li>`).join("")}</ol>`:""}

    ${Object.keys(tc).length?`${clubSec("c-titles","TITLES","獲得タイトル")}<div class="ti-grid">${Object.keys(tc).map(k=>`<div class="ti"><b>${tc[k].length}<small>回</small></b><div>${esc(k)}</div><p>${esc(tc[k].join("、"))}</p></div>`).join("")}</div>`:""}

    ${allS.length?`${clubSec("c-records","RECORDS","歴代成績")}<div class="tw"><table class="t hist-t"><thead><tr><th>シーズン</th><th class="l">リーグ</th><th>順位</th><th>勝-分-敗</th><th>得点-失点</th>${hasCup?`<th class="l">カップ戦</th>`:""}<th class="l">チーム得点王</th></tr></thead><tbody>
      ${allS.map(se=>{ const S=seasonInfo(se)||{}, r=recOf(se), rk=myRank(se), live=D.matches.some(m=>m.season===se&&!m.played);
        return `<tr><th>${esc(se)}</th><td class="l">${esc((S.league||leagueName(se)||"").replace(/姫路市社会人サッカー/,"姫路市"))}</td>
          <td class="num${rk==="1"&&!live?" gold":""}">${rk?`${esc(rk)}位${live?'<small>（途中）</small>':""}`:"-"}</td><td>${r?`${r.w}-${r.d}-${r.l}`:"-"}</td><td>${r&&r.gf!=null?`${r.gf}-${r.ga}`:"-"}</td>
          ${hasCup?`<td class="l${/優勝/.test(cupOf(S))?" gold":""}">${esc(cupOf(S)||"-")}</td>`:""}<td class="l">${topScorer(se)||"-"}</td></tr>`; }).join("")}</tbody></table></div>
      <p class="more-link"><a href="#table">今シーズンの順位表を見る</a></p>`:""}
  </div>`;
}
function bHistory(){ bindSel("hs-season", v=>{ ST.tblSeason=v; ST.tblComp=null; render(); }); bindSel("hs-comp", v=>{ ST.tblComp=v; render(); });
  document.querySelectorAll(".club-nav button").forEach(b=>b.onclick=()=>{ const el=$(b.dataset.to); if(!el) return; const nav=document.querySelector(".club-nav");
    window.scrollTo({top: el.getBoundingClientRect().top + scrollY - (document.getElementById("hd").offsetHeight + (nav?nav.offsetHeight:0) + 12), behavior:"smooth"}); }); }

/* =====================================================================
   ルーティング・メニュー
   ===================================================================== */
const ROUTES = {
  home:     [vHome, bHome, "HOME"],
  news:     [vNews, bNews, "NEWS", vNewsDetail, bNewsDetail],
  match:    [vMatch, bMatch, "MATCH", vMatchDetail, bMatchDetail],
  players:  [vPlayers, bPlayers, "PLAYERS"],
  player:   [null, null, "PLAYERS", vPlayerDetail, bPlayerDetail],
  stats:    [vStats, bStats, "STATS"],
  history:  [vHistory, bHistory, "CLUB"],
  join:     [vJoin, null, "選手募集"],
  contact:  [()=>vContact(""), bContact, "お問い合わせ", vContact, bContact],
  sponsor:  [vSponsor, null, "スポンサー募集"],
  transfer: [vTransfer, bTransfer, "加入・退団"],
  table:    [vTable, bTable, "順位表"],
  input:    [vInput, bInput, "試合結果の入力"]
};
function parseHash(){ const h=decodeURIComponent((location.hash||"").replace(/^#/,"")); const i=h.indexOf("/"); return i<0 ? {page:h||"home", arg:null} : {page:h.slice(0,i), arg:h.slice(i+1)}; }
let lastKey="";
function render(){
  let {page,arg}=parseHash(); if(!ROUTES[page]) { page="home"; arg=null; }
  const R=ROUTES[page];
  const nav = page==="player"||page==="transfer" ? "players" : page;
  const sid = entryId();
  document.querySelectorAll(".hd-nav a, .drawer-nav a").forEach(a=>a.classList.toggle("on", (a.dataset.nav||a.getAttribute("href").slice(1))===nav));
  const view=$("view");
  if(!D.loaded){ view.innerHTML=`<div class="wrap"><div class="loading">読み込み中…</div></div>`; return; }
  if(D.err){ view.innerHTML=`<div class="wrap">${empty(D.err)}</div>`; return; }
  const detail = arg!=null && R[3];
  const key=page+"/"+(arg||"").split("/")[0];
  if(page==="match" && detail && key!==lastKey && !String(arg).includes("/")) ST.mtab="sum";
  view.innerHTML = detail ? R[3](arg) : (R[0]?R[0]():"");
  if(detail && R[4]) R[4](); else if(!detail && R[1]) R[1]();
  hscroll();
  let title=R[2];
  if(detail){ const h=view.querySelector(".nd-head h1,.pd-name,.mh-comp"); if(h) title=h.textContent.trim(); }
  document.title = page==="home" ? `${clubName()} オフィシャルサイト` : `${title} | ${clubName()}`;
  if(key!==lastKey){ const y=POS[sid]; scrollToY(y!=null ? y : 0); lastKey=key; }
}
/* ---------- 横スクロールできる所を分かるように ----------
   左右に続きがあるときは、端をぼかして矢印ボタンを出す */
function hscroll(){
  document.querySelectorAll(".sc-strip,.pl-strip,.cn-in,.tw,.mlist-x").forEach(el=>{
    let w=el.parentElement;
    if(!w.classList.contains("hs")){ w=document.createElement("div"); w.className="hs"+(el.classList.contains("tw")?" hs-t":""); el.parentNode.insertBefore(w,el); w.appendChild(el);
      ["prev","next"].forEach(d=>{ const b=document.createElement("button"); b.type="button"; b.className="hs-btn "+d; b.setAttribute("aria-label", d==="prev"?"左へ":"右へ"); b.innerHTML=d==="prev"?"‹":"›";
        b.onclick=()=>el.scrollBy({left:(d==="prev"?-1:1)*Math.max(200, el.clientWidth*0.8), behavior:"smooth"}); w.appendChild(b); }); }
    const up=()=>{ const l=el.scrollLeft>4, r=el.scrollLeft+el.clientWidth<el.scrollWidth-4; w.classList.toggle("l",l); w.classList.toggle("r",r); };
    if(!el._hs){ el.addEventListener("scroll",up,{passive:true}); el._hs=1; }
    up(); setTimeout(up,300);
  });
}
window.addEventListener("resize", ()=>hscroll());

/* ---------- スクロール位置 ----------
   ページ（履歴）ごとにスクロール位置を覚えておき、ブラウザの「戻る」「進む」ではその位置に戻す。
   新しく開いたページは一番上から。 */
const POS_KEY="hfc-scroll";
let POS={}; try{ POS=JSON.parse(sessionStorage.getItem(POS_KEY)||"{}")||{}; }catch(e){}
let restoring=false, scrollGen=0;
function entryId(){
  const st=history.state; if(st && st.sid) return st.sid;
  const id=Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  history.replaceState(Object.assign({}, st||{}, {sid:id}), ""); return id;
}
function scrollToY(y){
  const gen=++scrollGen; restoring=true;
  const go=()=>{ if(gen!==scrollGen) return; window.scrollTo(0,y); };
  go(); requestAnimationFrame(go); setTimeout(go,60); setTimeout(go,250);
  setTimeout(()=>{ go(); if(gen===scrollGen) restoring=false; }, 600);   /* iPhoneのSafariは描き替え直後の命令を無視することがあるので何度か */
}
/* 自分でスクロールし始めたら、位置の自動調整はすぐやめる */
["wheel","touchstart","keydown","mousedown"].forEach(ev=>window.addEventListener(ev, ()=>{ if(restoring){ scrollGen++; restoring=false; } }, {passive:true}));
let posRaf=0;
window.addEventListener("scroll", ()=>{ if(posRaf) return; posRaf=requestAnimationFrame(()=>{ posRaf=0;
  const st=history.state; if(restoring || !st || !st.sid) return;
  POS[st.sid]=Math.round(window.scrollY);
  try{ sessionStorage.setItem(POS_KEY, JSON.stringify(POS)); }catch(e){} }); }, {passive:true});
if("scrollRestoration" in history) history.scrollRestoration="manual";
function setMenu(open){
  const btn=$("menu-btn"), dr=$("drawer");
  btn.setAttribute("aria-expanded", open?"true":"false"); btn.setAttribute("aria-label", open?"メニューを閉じる":"メニューを開く");
  dr.hidden=!open; document.body.classList.toggle("lock", open);
}
$("menu-btn").onclick=()=>setMenu($("drawer").hidden);
$("drawer-sns").innerHTML=$("ft-sns").innerHTML;
document.addEventListener("keydown", e=>{ if(e.key==="Escape") setMenu(false); });
matchMedia("(min-width:961px)").addEventListener("change", e=>{ if(e.matches) setMenu(false); });
window.addEventListener("hashchange", ()=>{ setMenu(false); render(); });
$("ft-year").textContent=new Date().getFullYear();
render();
loadAll().catch(e=>{ console.error(e); D.err="読み込み中にエラーが起きました。"; D.loaded=true; }).finally(render);
