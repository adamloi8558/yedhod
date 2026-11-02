// Browser regression for the real payment review component. All API responses
// are local fixtures; no production payment or bank service is contacted.
const assert = require('node:assert/strict');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..');
const fixtureRequire = createRequire(path.join(root, 'scripts/fhchannel-dl/package.json'));
const { chromium } = fixtureRequire('playwright');
const { build } = createRequire(fixtureRequire.resolve('tsx/package.json'))('esbuild');

async function main() {
  const bundle = await build({
    stdin: {
      contents: `import React from 'react';
        import { createRoot } from 'react-dom/client';
        import { PaymentActions } from './src/components/payment-actions';
        const props = {paymentId:'fixture',status:'pending',provider:'easyslip',hasSlip:true};
        createRoot(document.getElementById('root')).render(<PaymentActions {...props} />);`,
      resolveDir: path.join(root, 'apps/backoffice'), loader: 'tsx',
    },
    bundle: true, write: false, jsx: 'automatic', format: 'iife',
    plugins: [{ name: 'router-fixture', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
        contents: 'export const useRouter = () => ({refresh: () => {window.refreshes = (window.refreshes || 0) + 1;}});',
      }));
    } }],
  });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let failOptions = false, postError = null;
    const submissions = [];
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('http://review.test/**', async route => {
      const request = route.request();
      if (request.url().endsWith('/api/payments/fixture/approve')) {
        if (request.method() === 'POST') {
          submissions.push(request.postDataJSON());
          return route.fulfill({status:postError ? 409 : 200,json:postError ? {error:postError} : {success:true}});
        }
        return route.fulfill({status:failOptions ? 503 : 200,json:failOptions ? {error:'Unavailable'} : {
          existingSubscriptions:[{id:'manual-grant',status:'active',startDate:'2026-11-02T07:42:11Z',endDate:'2026-11-09T07:42:11Z',amountPaid:'69.00'}],
        }});
      }
      return route.fulfill({contentType:'text/html',body:'<!doctype html><div id="root"></div>'});
    });
    async function openReview() {
      await page.goto('http://review.test/');
      await page.addScriptTag({content:bundle.outputFiles[0].text});
      await page.getByRole('button',{name:'อนุมัติ',exact:true}).click();
    }
    await openReview();
    await page.getByRole('combobox').waitFor();
    const submit = page.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true});
    assert.equal(await submit.isEnabled(),true);
    await submit.click();
    await page.getByRole('alert').filter({hasText:'กรุณากรอกเลขธุรกรรม'}).waitFor();
    assert.equal(submissions.length,0);
    assert.equal(await page.getByLabel('เลขธุรกรรมธนาคาร',{exact:true}).evaluate(e=>e===document.activeElement),true);
    await page.getByLabel('เลขธุรกรรมธนาคาร',{exact:true}).fill('BANK 123456');
    await submit.click();
    assert.equal(submissions.length,0);
    await page.getByLabel('เลขธุรกรรมธนาคาร',{exact:true}).fill(' BANK-123456 ');
    await submit.click();
    await page.getByRole('alert').filter({hasText:'กรุณาติ๊กยืนยัน'}).waitFor();
    assert.equal(submissions.length,0);
    await page.getByRole('checkbox').check();
    await page.getByRole('combobox').selectOption('manual-grant');
    await page.getByRole('button',{name:'ยืนยันผูกสิทธิ์เดิม'}).click();
    await page.waitForFunction(()=>window.refreshes===1);
    assert.deepEqual(submissions,[{transRef:'BANK-123456',confirmed:true,existingSubscriptionId:'manual-grant'}]);
    console.log('PASS missing and invalid reference, missing confirmation, explicit manual grant selection');

    postError='เลขธุรกรรมนี้ใช้กับรายการหรือสิทธิ์อื่นแล้ว';
    await page.getByRole('button',{name:'ยืนยันผูกสิทธิ์เดิม'}).click();
    await page.getByRole('alert').filter({hasText:postError}).waitFor();
    assert.equal(await page.evaluate(()=>window.refreshes),1);
    assert.equal(await page.getByRole('combobox').inputValue(),'manual-grant');
    assert.equal(await page.getByRole('button',{name:'ยืนยันผูกสิทธิ์เดิม'}).isEnabled(),true);
    console.log('PASS server rejection is visible and preserves entered data');

    failOptions=true;
    await openReview();
    await page.getByRole('button',{name:'โหลดสิทธิ์เดิมอีกครั้ง'}).waitFor();
    await page.getByLabel('เลขธุรกรรมธนาคาร',{exact:true}).fill('BANK-NEW-123');
    await page.getByRole('checkbox').check();
    const before=submissions.length;
    await page.getByRole('button',{name:'ยืนยันอนุมัติ',exact:true}).click();
    await page.getByRole('alert').filter({hasText:'กรุณารอโหลดสิทธิ์เดิม'}).waitFor();
    assert.equal(submissions.length,before);
    failOptions=false;
    await page.getByRole('button',{name:'โหลดสิทธิ์เดิมอีกครั้ง'}).click();
    await page.getByRole('combobox').waitFor();
    await page.getByRole('button',{name:'ยกเลิกอนุมัติ'}).click();
    await page.getByRole('button',{name:'อนุมัติ',exact:true}).waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS lookup failure blocks submission; retry and cancel recover the form');
  } finally {
    await browser.close();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
