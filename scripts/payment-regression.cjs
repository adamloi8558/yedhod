// Runs actual route handlers and Drizzle transactions against a disposable local DB.
// Set TEST_DATABASE_URL to a local DB whose schema was created with drizzle-kit push.
process.env.TZ = 'UTC';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { AsyncLocalStorage } = require('node:async_hooks');
const root = path.resolve(__dirname, '..');
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const dbRequire = createRequire(path.join(root, 'packages/db/package.json'));
const ts = webRequire('typescript');
const url = process.env.TEST_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('TEST_DATABASE_URL must be a disposable local database');
process.env.DATABASE_URL = url;
const context = new AsyncLocalStorage();
const cache = new Map();
const mocks = new Map();
let dbModule;
let uploads = 0;
let calls = 0;
let storageFail = false;
let provider;
let apiKey = 'test-key';
const account = { id: 'bank', bankCode: '002', bankName: 'test', accountNumber: '6645533950', accountName: 'test', isActive: true, weight: 100 };
function load(name) {
  let filename = path.resolve(root, name);
  if (!path.extname(filename)) filename += fs.existsSync(filename + '.ts') ? '.ts' : '/index.ts';
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  function req(spec) {
    if (mocks.has(spec)) return mocks.get(spec);
    if (spec === '@/lib/auth-server') return { getSession: async () => context.getStore()?.user ? { user: { id: context.getStore().user } } : null, getAdminSession: async () => context.getStore()?.admin ? { user: { id: 'admin' } } : null };
    if (spec === '@kodhom/r2') return { uploadBuffer: async () => { uploads++; if (storageFail) throw new Error('storage unavailable'); } };
    if (spec === '@kodhom/easyslip') return { ...load('packages/easyslip/src/rules.ts'), verifyBankSlip: async () => { calls++; return provider(); } };
    if (spec === '@/lib/payment-config') return { getEasySlipConfig: async () => ({ apiKey }), getPaymentMode: async () => 'easyslip', getPaymentAccounts: async () => [account], pickWeightedAccount: a => a[0] };
    if (spec === '@kodhom/db') return dbModule ?? load('packages/db/src/index.ts');
    if (spec === '@kodhom/db/schema') return load('packages/db/src/schema/index.ts');
    if (spec.startsWith('@/')) return load('apps/web/src/' + spec.slice(2));
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(filename), spec.replace(/\.js$/, '.ts')));
    try { return createRequire(filename)(spec); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; return webRequire(spec); }
  }
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', output)(req, module, module.exports);
  return module.exports;
}
dbModule = load('packages/db/src/index.ts');
const pg = dbRequire('postgres')(url, { max: 4, onnotice: () => {} });
const verify = load('apps/web/src/app/api/payments/[ref]/verify-slip/route.ts').POST;
const create = load('apps/web/src/app/api/payments/create-easyslip/route.ts').POST;
const approve = load('apps/backoffice/src/app/api/payments/[id]/approve/route.ts').POST;
const reject = load('apps/backoffice/src/app/api/payments/[id]/reject/route.ts').POST;
const { tailMatches } = load('packages/easyslip/src/match.ts');
const { slipRuleError } = load('packages/easyslip/src/rules.ts');
const { readSlipUpload } = load('apps/web/src/lib/slip-upload.ts');
const { retryDelayMs } = load('apps/telegram-sync/src/retry.ts');
const now = Date.now();
function slip(ref = 'BANK-TRANSFER-1') { return { ok: true, data: { isDuplicate: false, rawSlip: {
  transRef: ref, date: new Date(now).toISOString(), amount: { amount: 69 },
  receiver: { bank: { id: '002' }, account: { bank: { type: 'BANKAC', account: '664-5-xxx950' } } }
} } }; }
function request(body, image = false) {
  if (!image) return new Request('http://localhost/api', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const form = new FormData(); form.append('slip', new File([Buffer.from([255,216,255,1,2,3])], 'slip.jpg', { type: 'image/jpeg' }));
  return new Request('http://localhost/api', { method: 'POST', body: form });
}
function call(handler, id, user = 'u1', body = {}) {
  return context.run({ user, admin: user === 'admin' }, () => handler(request(body, handler === verify), { params: Promise.resolve({ id, ref: id }) }));
}
async function reset() {
  await pg`truncate admin_audit_logs, subscriptions, payments, users, pricing_plans, telegram_sync_messages, system_config cascade`;
  await pg`insert into users (id,name,email) values ('u1','test1','u1@test.invalid'),('u2','test2','u2@test.invalid'),('admin','admin','admin@test.invalid')`;
  await pg`insert into pricing_plans (id,name,slug,duration_days,price_thb) values ('plan','test','test',30,69),('plan2','test2','test2',30,139)`;
  calls = uploads = 0; storageFail = false; apiKey = 'test-key'; provider = async () => slip();
}
async function order(id = 'p1', user = 'u1', opts = {}) {
  await pg`insert into payments (id,user_id,pricing_plan_id,provider,amount,account_snapshot,created_at,expires_at,status,slip_image_r2_key)
    values (${id},${user},'plan','easyslip',69,${pg.json(account)},${new Date(now - 60_000)},${new Date(now + 1800_000)},${opts.status ?? 'pending'},${opts.slip ?? null})`;
}
async function counts() { return (await pg`select (select count(*)::int from subscriptions) as subs, (select count(*)::int from payments where status='completed') as paid`)[0]; }
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
test('masked account positions: positive and negative controls', async () => {
  for (const mask of ['664-5-xxx950','xxx-x-x3395-0','xxx-x-x3395-x','6645533950']) assert.equal(tailMatches(mask,account.accountNumber),true,mask);
  for (const mask of ['3395','xxxxxx950','123-4-xxx950','664-5-xxx951','66455339500','664?533950']) assert.equal(tailMatches(mask,account.accountNumber),false,mask);
});
test('rules reject bad dates, amounts, bank/proxy accounts and malformed response', async () => {
  const expected = { amount:'69.00', bankCode:'002', accountNumber:account.accountNumber, createdAt:new Date(now-60_000),expiresAt:new Date(now+1800_000),now };
  assert.equal(slipRuleError(slip().data,expected),null);
  for (const mutate of [d=>d.rawSlip.date='bad',d=>d.rawSlip.amount.amount=NaN,d=>d.rawSlip.amount.amount=69.01,d=>d.rawSlip.receiver.bank.id='004',d=>d.rawSlip.receiver.account.bank.type='TOKEN',d=>d.rawSlip.date=new Date(now+120_000).toISOString(),d=>d.rawSlip.date=new Date(now-600_000).toISOString()]) {
    const data=slip().data;mutate(data);assert.ok(slipRuleError(data,expected));
  }
});
test('upload bounds and MIME spoofing', async () => {
  const bad=new FormData();bad.append('slip',new File(['<script>bad</script>'],'slip.jpg',{type:'image/jpeg'}));
  await assert.rejects(()=>readSlipUpload(new Request('http://localhost',{method:'POST',body:bad})));
  const huge=new FormData();huge.append('slip',new File([new Uint8Array(4*1024*1024+1)],'large.png'));
  await assert.rejects(()=>readSlipUpload(new Request('http://localhost',{method:'POST',body:huge})));
  assert.equal((await readSlipUpload(request({},true))).mime,'image/jpeg');
});
test('valid transfer completes once; response retry is idempotent', async () => {
  await order();assert.equal((await call(verify,'p1')).status,200);assert.equal((await call(verify,'p1')).status,200);
  assert.deepEqual({...await counts()},{subs:1,paid:1});assert.equal(calls,1);
});
test('parallel submissions cannot double grant', async () => {
  await order();provider=async()=>{await new Promise(r=>setTimeout(r,80));return slip();};
  const results=await Promise.all(Array.from({length:5},()=>call(verify,'p1')));
  assert.ok(results.some(r=>r.status===200));assert.deepEqual({...await counts()},{subs:1,paid:1});assert.equal(calls,1);
});
test('same bank transfer across two users grants only once', async () => {
  await order();await order('p2','u2');await Promise.all([call(verify,'p1'),call(verify,'p2','u2')]);
  assert.deepEqual({...await counts()},{subs:1,paid:1});
});
test('expired upload accepts transfer made during original window', async () => {
  await order();await pg`update payments set created_at=${new Date(now-7200_000)},expires_at=${new Date(now-3600_000)}`;
  provider=async()=>{const s=slip();s.data.rawSlip.date=new Date(now-5400_000).toISOString();return s;};
  assert.equal((await call(verify,'p1')).status,200);
});
test('late transfer retained for review without credit', async () => {
  await order();await pg`update payments set expires_at=${new Date(now-1000)}`;
  const r=await call(verify,'p1');assert.equal((await r.json()).code,'TRANSFER_AFTER_EXPIRY');assert.equal((await counts()).subs,0);
});
test('current plan price change does not invalidate original payment amount',async()=>{
  await order();await pg`update pricing_plans set price_thb=99 where id='plan'`;
  assert.equal((await call(verify,'p1')).status,200);
});
test('unknown provider duplicate preserves evidence and requires review',async()=>{
  await order();provider=async()=>{const s=slip();s.data.isDuplicate=true;return s;};
  assert.equal((await (await call(verify,'p1')).json()).code,'DUPLICATE_REVIEW');
  const [p]=await pg`select status,slip_image_r2_key from payments`;assert.equal(p.status,'pending');assert.ok(p.slip_image_r2_key);assert.equal((await counts()).subs,0);
});
test('provider timeout and missing key retain evidence and audit reason',async()=>{
  await order();provider=async()=>({ok:false,code:'TIMEOUT',message:'retry'});
  assert.equal((await (await call(verify,'p1')).json()).manualReview,true);
  assert.equal((await pg`select metadata->>'code' as code from admin_audit_logs`)[0].code,'TIMEOUT');
  await order('p2','u2');apiKey='';assert.equal((await (await call(verify,'p2','u2')).json()).code,'MISSING_API_KEY');
});
test('storage failure does not call provider or grant entitlement',async()=>{
  await order();storageFail=true;assert.equal((await call(verify,'p1')).status,503);assert.equal(calls,0);assert.equal((await counts()).subs,0);
});
test('ownership and authentication enforced',async()=>{
  await order();assert.equal((await call(verify,'p1','u2')).status,404);assert.equal((await call(verify,'p1',null)).status,401);assert.equal(uploads,0);
});
test('retry rate limited',async()=>{
  await order();provider=async()=>({ok:false,code:'SLIP_PENDING',message:'wait'});
  await call(verify,'p1');assert.equal((await call(verify,'p1')).status,429);assert.equal(calls,1);
});
test('create resumes review; another plan does not discard pending evidence',async()=>{
  await order('p1','u1',{slip:'saved.jpg'});await pg`update payments set expires_at=${new Date(now-3600_000)}`;
  const resumed=await call(create,null,'u1',{pricingPlanId:'plan'});assert.equal((await resumed.json()).paymentId,'p1');
  assert.equal((await call(create,null,'u1',{pricingPlanId:'plan2'})).status,200);
  assert.equal((await pg`select status from payments where id='p1'`)[0].status,'pending');
});
test('parallel order creation produces one pending order',async()=>{
  await Promise.all(Array.from({length:5},()=>call(create,null,'u1',{pricingPlanId:'plan'})));
  assert.equal((await pg`select count(*)::int as n from payments`)[0].n,1);
});
test('manual approval needs evidence, confirmation and bank reference',async()=>{
  await order();assert.equal((await call(approve,'p1','admin')).status,400);assert.equal((await counts()).subs,0);
});
test('manual approve stores reference; later automatic replay cannot grant',async()=>{
  await order('p1','u1',{slip:'saved.jpg'});assert.equal((await call(approve,'p1','admin',{transRef:'BANK-TRANSFER-1',confirmed:true})).status,200);
  await order('p2','u2');await call(verify,'p2','u2');assert.deepEqual({...await counts()},{subs:1,paid:1});
});
test('reconcile a prior manual grant without extending or creating a second subscription',async()=>{
  await order('p1','u1',{slip:'saved.jpg'});
  const end=new Date(now+86400_000);
  await pg`insert into subscriptions(id,user_id,pricing_plan_id,status,end_date,payment_ref) values('sub1','u1','plan','active',${end},'admin-grant-sub1')`;
  const body={transRef:'BANK-TRANSFER-1',confirmed:true};assert.equal((await call(approve,'p1','admin',body)).status,409);
  assert.equal((await call(approve,'p1','admin',{...body,existingSubscriptionId:'sub1'})).status,200);
  assert.deepEqual({...await counts()},{subs:1,paid:1});assert.equal((await pg`select end_date from subscriptions`)[0].end_date.getTime(),end.getTime());
});
test('approve/reject race never revokes a completed payment',async()=>{
  await order('p1','u1',{slip:'saved.jpg'});await Promise.all([call(approve,'p1','admin',{transRef:'BANK-TRANSFER-1',confirmed:true}),call(reject,'p1','admin')]);
  const [p]=await pg`select status from payments`;const n=(await counts()).subs;assert.ok((p.status==='completed'&&n===1)||(p.status==='failed'&&n===0));
});
test('Telegram flood waits are respected with bounded transient backoff',async()=>{
  assert.equal(retryDelayMs({seconds:566},1),571000);assert.equal(retryDelayMs(new Error('FLOOD_WAIT_120'),1),125000);assert.equal(retryDelayMs(new Error('offline'),30),900000);
});
test('Telegram catches up oldest-first across multiple bounded polling cycles',async()=>{
  const tgRequire=createRequire(path.join(root,'apps/telegram-sync/package.json'));
  const {Api}=tgRequire('telegram');
  await pg`insert into categories(id,name,slug) values('cat','test','test') on conflict do nothing`;
  mocks.set('./topics.js',{isForumGroup:async()=>false,getGroupTitle:async()=> 'test',getOrCreateCategory:async()=> 'cat'});
  const utils=load('apps/telegram-sync/src/utils.ts');mocks.set('./utils.js',{...utils,delay:async()=>{}});
  const {backfill}=load('apps/telegram-sync/src/sync.ts');
  const messages=Array.from({length:150},(_,i)=>new Api.Message({id:i+1,date:0,message:'no media',peerId:new Api.PeerChat({chatId:1})}));
  const client={getMessages:async(_group,options)=>{if(options.ids)return messages.filter(m=>options.ids.includes(m.id));assert.equal(options.reverse,true);return messages.filter(m=>m.id>(options.minId??0)).slice(0,options.limit);}};
  await backfill(client,{},'test-group');
  assert.equal((await pg`select count(*)::int as n from telegram_sync_messages`)[0].n,100);
  await backfill(client,{},'test-group');
  assert.equal((await pg`select count(*)::int as n from telegram_sync_messages`)[0].n,150);
  await pg`update telegram_sync_messages set status='failed' where telegram_message_id=10`;
  const {getLastSyncedMessageId,getFailedMessageIds}=load('apps/telegram-sync/src/db-operations.ts');
  assert.equal(await getLastSyncedMessageId('test-group',0),150);
  await pg`update telegram_sync_messages set created_at=now()-interval '20 minutes' where status='failed'`;
  assert.deepEqual(await getFailedMessageIds('test-group',0),[10]);
  await backfill(client,{},'test-group');
  assert.equal((await pg`select status from telegram_sync_messages where telegram_message_id=10`)[0].status,'skipped');
});
test('Requested Telegram replay cannot skip undiscovered older messages',async()=>{
  const {Api}=createRequire(path.join(root,'apps/telegram-sync/package.json'))('telegram');
  await pg`insert into categories(id,name,slug) values('cat','test','test') on conflict do nothing`;
  await pg`insert into telegram_sync_messages(id,telegram_group_id,telegram_topic_id,telegram_message_id,status,error_message,created_at)
    values('requested','priority-group',0,1000,'failed','Backfill requested from 2026-09-07T17:00:00.000Z',now()-interval '20 minutes')`;
  const {recordSyncedMessage,getRequestedBackfillMessageIds}=load('apps/telegram-sync/src/db-operations.ts');
  await recordSyncedMessage({telegramGroupId:'priority-group',telegramTopicId:0,telegramMessageId:1000,categoryId:'cat',clipId:null,mediaType:'video',status:'failed',errorMessage:'temporary download error'});
  const [retryRecord]=await pg`select error_message from telegram_sync_messages where id='requested'`;
  assert.match(retryRecord.error_message,/^Backfill requested from .*temporary download error$/);
  await pg`update telegram_sync_messages set created_at=now()-interval '20 minutes' where id='requested'`;
  assert.deepEqual(await getRequestedBackfillMessageIds('priority-group',0),[1000]);
  mocks.set('./topics.js',{isForumGroup:async()=>false,getGroupTitle:async()=> 'test',getOrCreateCategory:async()=> 'cat'});
  const utils=load('apps/telegram-sync/src/utils.ts');
  const realNow=Date.now;let clock=realNow();
  const mockUtils={...utils,delay:async()=>{clock+=61000;}};mocks.set('./utils.js',mockUtils);
  cache.delete(path.resolve(root,'apps/telegram-sync/src/sync.ts'));
  const {backfill}=load('apps/telegram-sync/src/sync.ts');
  const {getLastSyncedMessageId}=load('apps/telegram-sync/src/db-operations.ts');
  const messages=[...Array.from({length:150},(_,i)=>i+1),1000].map(id=>new Api.Message({id,date:0,message:'no media',peerId:new Api.PeerChat({chatId:1})}));
  const client={getMessages:async(_group,options)=>options.ids?messages.filter(m=>options.ids.includes(m.id)):messages.filter(m=>m.id>(options.minId??0)).slice(0,options.limit)};
  try {Date.now=()=>clock;await backfill(client,{},'priority-group');}finally{Date.now=realNow;}
  assert.equal((await pg`select status from telegram_sync_messages where id='requested'`)[0].status,'skipped');
  assert.equal(await getLastSyncedMessageId('priority-group',0),null);
  mockUtils.delay=async()=>{};
  await backfill(client,{},'priority-group');
  assert.equal(await getLastSyncedMessageId('priority-group',0),100);
  await backfill(client,{},'priority-group');
  assert.equal((await pg`select count(*)::int as n from telegram_sync_messages where telegram_group_id='priority-group' and telegram_message_id<=150`)[0].n,150);
  assert.equal(await getLastSyncedMessageId('priority-group',0),1000);
});
test('Large forum yields between topics and resumes the next topic',async()=>{
  const {Api}=createRequire(path.join(root,'apps/telegram-sync/package.json'))('telegram');
  await pg`insert into categories(id,name,slug) values('cat','test','test') on conflict do nothing`;
  mocks.set('./topics.js',{isForumGroup:async()=>true,getForumTopics:async()=>new Map([[10,'one'],[20,'two'],[30,'three']]),getOrCreateCategory:async()=> 'cat'});
  const realNow=Date.now;let clock=realNow();
  mocks.set('./utils.js',{...load('apps/telegram-sync/src/utils.ts'),delay:async()=>{clock+=61000;}});
  cache.delete(path.resolve(root,'apps/telegram-sync/src/sync.ts'));
  const {backfill}=load('apps/telegram-sync/src/sync.ts');const visited=[];
  const client={getMessages:async(_group,options)=>{if(options.ids)return[];visited.push(options.replyTo);return [new Api.Message({id:options.replyTo+1,date:0,message:'no media',peerId:new Api.PeerChat({chatId:1})})];}};
  try {Date.now=()=>clock;await backfill(client,{},'fair-group');await backfill(client,{},'fair-group');}finally{Date.now=realNow;}
  assert.deepEqual(visited,[10,20]);
});
test('Telegram streams complete files and cleans temporary data on success and failures',async()=>{
  const {Api}=createRequire(path.join(root,'apps/telegram-sync/package.json'))('telegram');
  const payload=Buffer.from('test-media-data');let outputFile;let truncated=false;let storageError=false;let sent=0;
  mocks.set('@kodhom/r2',{
    uploadBuffer:async()=>{throw new Error('Full video must not use uploadBuffer');},
    uploadStream:async(_key,stream,_mime,length)=>{
      sent++;assert.equal(length,payload.length);const chunks=[];
      for await(const chunk of stream)chunks.push(chunk);
      assert.deepEqual(Buffer.concat(chunks),payload);
      if(storageError)throw new Error('test storage outage');
    },
  });
  cache.delete(path.resolve(root,'apps/telegram-sync/src/media.ts'));
  const {downloadAndUploadMedia}=load('apps/telegram-sync/src/media.ts');
  const message=new Api.Message({id:1,date:0,message:'',peerId:new Api.PeerChat({chatId:1}),media:new Api.MessageMediaDocument({
    document:new Api.Document({id:1n,accessHash:0n,fileReference:Buffer.alloc(0),date:0,mimeType:'video/mp4',size:BigInt(payload.length),dcId:1,attributes:[]}),
  })});
  const client={downloadMedia:async(_message,options)=>{
    const stream=options.outputFile;outputFile=stream.path;assert.equal(typeof stream.write,'function');
    const write=stream._write.bind(stream);
    stream._write=(chunk,encoding,callback)=>setTimeout(()=>write(chunk,encoding,callback),25);
    stream.write(truncated?payload.subarray(0,2):payload);stream.end();return outputFile;
  }};
  try {
    const result=await downloadAndUploadMedia(client,message);assert.equal(result.fileSize,payload.length);assert.equal(sent,1);assert.equal(fs.existsSync(path.dirname(outputFile)),false);
    truncated=true;await assert.rejects(()=>downloadAndUploadMedia(client,message),/Incomplete media download/);assert.equal(sent,1);assert.equal(fs.existsSync(path.dirname(outputFile)),false);
    truncated=false;storageError=true;await assert.rejects(()=>downloadAndUploadMedia(client,message),/test storage outage/);assert.equal(fs.existsSync(path.dirname(outputFile)),false);
  } finally {mocks.delete('@kodhom/r2');}
});
test('Concurrent Telegram cursors retain both sources and cannot be edited as public settings',async()=>{
  const {saveSyncCursor,getLastSyncedMessageId}=load('apps/telegram-sync/src/db-operations.ts');
  await Promise.all([saveSyncCursor('first-source',1,50),saveSyncCursor('second-source',2,80)]);
  assert.equal(await getLastSyncedMessageId('first-source',1),50);assert.equal(await getLastSyncedMessageId('second-source',2),80);
  const config=load('apps/backoffice/src/app/api/config/route.ts');
  const list=await context.run({admin:true},()=>config.GET());assert.deepEqual(await list.json(),[]);
  const edit=await context.run({admin:true},()=>config.POST(request({key:'telegram_sync_cursors',value:{}})));
  assert.equal(edit.status,400);assert.equal(await getLastSyncedMessageId('first-source',1),50);
});
test('Requested recovery avoids unrelated history and ignores removed sources',async()=>{
  const {Api}=createRequire(path.join(root,'apps/telegram-sync/package.json'))('telegram');
  await pg`insert into categories(id,name,slug) values('cat','test','test') on conflict do nothing`;
  await pg`insert into telegram_sync_messages(id,telegram_group_id,telegram_topic_id,telegram_message_id,status,error_message,created_at)
    values('only-requested','requested-only',0,500,'failed','Backfill requested from test',now()-interval '20 minutes')`;
  const {hasReadyRequestedBackfill,getLastSyncedMessageId}=load('apps/telegram-sync/src/db-operations.ts');
  assert.equal(await hasReadyRequestedBackfill(['requested-only']),true);
  await pg`update telegram_sync_messages set created_at=now() where id='only-requested'`;
  assert.equal(await hasReadyRequestedBackfill(['requested-only']),false,'Recovery pacing must honor the failed-message cooldown');
  await pg`update telegram_sync_messages set created_at=now()-interval '20 minutes' where id='only-requested'`;
  assert.equal(await hasReadyRequestedBackfill(['requested-only']),true);
  assert.equal(await hasReadyRequestedBackfill(['other-source']),false);
  assert.equal(await hasReadyRequestedBackfill([]),false);
  mocks.set('./topics.js',{isForumGroup:async()=>false,getGroupTitle:async()=> 'test',getOrCreateCategory:async()=> 'cat'});
  mocks.set('./utils.js',{...load('apps/telegram-sync/src/utils.ts'),delay:async()=>{}});
  cache.delete(path.resolve(root,'apps/telegram-sync/src/sync.ts'));
  const {backfill}=load('apps/telegram-sync/src/sync.ts');
  const client={getMessages:async(_group,options)=>{assert.ok(options.ids,'Recovery must not request unrelated history');return [new Api.Message({id:500,date:0,message:'no media',peerId:new Api.PeerChat({chatId:1})})];}};
  await backfill(client,{},'requested-only',{requestedOnly:true});
  assert.equal(await getLastSyncedMessageId('requested-only',0),null);
  assert.equal(await hasReadyRequestedBackfill(['requested-only']),false);
});
test('New message discovery advances independently of older download history',async()=>{
  const {Api}=createRequire(path.join(root,'apps/telegram-sync/package.json'))('telegram');
  const {saveSyncCursor,getLastSyncedMessageId,hasReadyRequestedBackfill}=load('apps/telegram-sync/src/db-operations.ts');
  await saveSyncCursor('live-source',-1,1);await saveSyncCursor('live-source',0,1);
  mocks.set('./topics.js',{isForumGroup:async()=>false});
  mocks.set('./utils.js',{...load('apps/telegram-sync/src/utils.ts'),delay:async()=>{}});
  const {discoverNewMessages}=load('apps/telegram-sync/src/discovery.ts');
  const media=new Api.MessageMediaDocument({document:new Api.Document({id:1n,accessHash:0n,fileReference:Buffer.alloc(0),date:0,mimeType:'video/mp4',size:15n,dcId:1,attributes:[]})});
  const messages=[new Api.Message({id:2,date:0,message:'',media,peerId:new Api.PeerChat({chatId:1})}),new Api.Message({id:3,date:0,message:'text',peerId:new Api.PeerChat({chatId:1})})];
  const client={getMessages:async(_group,options)=>messages.filter(message=>message.id>options.minId),downloadMedia:async()=>{throw new Error('Discovery must not download media');}};
  await discoverNewMessages(client,{},'live-source');
  assert.equal(await getLastSyncedMessageId('live-source',-1),3);
  assert.equal(await getLastSyncedMessageId('live-source',0),1);
  assert.equal(await hasReadyRequestedBackfill(['live-source']),true);
  const rows=await pg`select telegram_message_id,status from telegram_sync_messages where telegram_group_id='live-source' order by telegram_message_id`;
  assert.deepEqual([...rows],[{telegram_message_id:2,status:'failed'},{telegram_message_id:3,status:'skipped'}]);
  await discoverNewMessages(client,{},'live-source');
  assert.equal((await pg`select count(*)::int as n from telegram_sync_messages where telegram_group_id='live-source'`)[0].n,2);
});
(async()=>{
  let passed=0;
  try { for(const [name,fn] of tests){await reset();await fn();passed++;console.log('PASS',name);}console.log(`${passed}/${tests.length} passed`); }
  finally { await pg.end();await globalThis.__kodhom_pg__?.end(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
