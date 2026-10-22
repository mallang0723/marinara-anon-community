const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

function luminance(rgb) {
  const channels = rgb.match(/[\d.]+/g).slice(0, 3).map(Number).map(v => v / 255)
    .map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels.reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
}
function contrast(a, b) {
  const values = [luminance(a), luminance(b)].sort((a, b) => a - b);
  return (values[1] + .05) / (values[0] + .05);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ timezoneId: 'Asia/Seoul' });
    const page = await context.newPage();
    const source = fs.readFileSync('extension.js', 'utf8');
    const startup = /  if \(document\.readyState === "loading"\) document\.addEventListener\("DOMContentLoaded", installDom, \{ once: true \}\);\n  else installDom\(\);/;
    assert(startup.test(source), 'Expected extension startup boundary');
    const instrumented = source.replace(startup,
      '  window.communityTest={state,normalizeState,render,handleClick,handleChange,SHADOW_CSS,POV_CSS,ROOT_ID};');
    await page.setContent('<!doctype html><meta charset="utf-8"><title>Community UI regression</title>');
    await page.evaluate(() => {
      window.marinara = { onCleanup() {}, storage: { patch: async () => ({ ok: true }) } };
    });
    await page.addScriptTag({ content: instrumented });
    await page.evaluate(() => {
      const t = window.communityTest;
      const host = document.createElement('div');
      host.id = t.ROOT_ID;
      document.body.append(host);
      const root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = t.SHADOW_CSS + t.POV_CSS;
      root.append(style);
      const panel = document.createElement('section');
      panel.className = 'panel';
      root.append(panel);
      root.addEventListener('click', event => {
        void t.handleClick(event).catch(error => { window.communityUiError = String(error); });
      });
      root.addEventListener('change', event => {
        void t.handleChange(event).catch(error => { window.communityUiError = String(error); });
      });
    });
    for (const width of [320, 393, 1024]) {
      await page.setViewportSize({ width, height: 852 });
      for (const darkMode of [false, true]) {
        await page.evaluate(darkMode => {
          const t = window.communityTest;
          t.state.data = t.normalizeState({ schemaVersion: 2, settings: { theme: 'reddit', darkMode, rpTimeRead: true },
            boards: { room: { chatType: 'RP', chatName: '테스트 방', rpNow: Date.parse('2024-10-18T14:30:00Z'),
              posts: [{ id: 'post', no: 1, title: '긴 게시글 제목과 관계 이야기 테스트', body: '본문이 좁은 세로줄로 눌리지 않아야 합니다. '.repeat(12),
                createdAt: '2024-10-18T14:28:00Z', a: { k: 0, fixed: 'u/very_long_test_nickname_for_mobile_wrapping' },
                comments: [{ id: 'c1', body: '댓글 내용', createdAt: '2024-10-18T14:29:00Z', a: { k: 1 } }], up: 84, down: 1, cat: '사건/목격' }] } } });
          t.state.activeChatId = 'room'; t.state.open = true; t.state.view = 'list'; t.state.tab = 0;
          t.state.page = 1; t.state.detail = null; t.render();
        }, darkMode);
        const geometry = await page.locator('.l-reddit .card').evaluate(card => {
          const get = selector => { const b = card.querySelector(selector).getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, bottom: b.bottom }; };
          return { top: get('.r-top'), title: get('.r-title'), body: get('.prev'), pills: get('.pills'), width: card.getBoundingClientRect().width };
        });
        assert(geometry.title.y >= geometry.top.bottom - 1, 'Title must follow author row vertically');
        assert(geometry.body.y >= geometry.title.bottom - 1, 'Preview must follow title vertically');
        assert(geometry.pills.y >= geometry.body.bottom - 1, 'Actions must follow preview vertically');
        assert(geometry.body.width > geometry.width * .7, 'Preview must not collapse into a narrow column');
        assert((await page.locator('.l-reddit .card .rp-stamp').innerText()).includes('2024.10.18 23:28'));
        await page.locator('.l-reddit .card').click();
        await page.waitForSelector('.d-reddit');
        assert((await page.locator('.d-reddit .d-head .rp-stamp').innerText()).includes('2024.10.18 23:28'));
        assert((await page.locator('.rc .rp-stamp').first().innerText()).includes('2024.10.18 23:29'));
        const bookmark = page.locator('.v-reddit [data-act=bookmark]');
        for (let step = 0; step < 3; step++) {
          const saved = step === 1;
          await bookmark.waitFor();
          assert.equal(await bookmark.getAttribute('aria-pressed'), String(saved));
          const colors = await bookmark.evaluate(button => ({
            background: getComputedStyle(button).backgroundColor,
            text: getComputedStyle(button.querySelector('span')).color,
            icon: getComputedStyle(button.querySelector('svg')).color,
            width: button.getBoundingClientRect().width,
            right: button.getBoundingClientRect().right
          }));
          assert(contrast(colors.background, colors.text) >= 4.5, 'Bookmark text contrast');
          assert(contrast(colors.background, colors.icon) >= 3, 'Bookmark icon contrast');
          assert(colors.width > 44 && colors.right <= width + 1, 'Bookmark must remain visible');
          if (saved === false && (await bookmark.innerText()).includes('저장됨')) assert.fail('Bookmark state label mismatch');
          if (saved === false && (await page.evaluate(() => window.communityTest.state.data.bookmarks.length)) !== 0) assert.fail('Bookmark removal mismatch');
          if (step < 2) {
            await bookmark.click();
            await page.waitForFunction(expected => window.communityTest.state.data.bookmarks.length === expected, step === 0 ? 1 : 0);
          }
        }
        assert.equal(await page.evaluate(() => window.communityUiError || ''), '');
        console.log(`PASS Reddit browser: ${width}px ${darkMode ? 'dark' : 'light'}, card geometry, full timestamps, bookmark contrast and save/remove`);
        await page.evaluate(() => {
          const t=window.communityTest, board=t.state.data.boards.room;
          for(const mode of ['reader','drama']) board.posts.push({...JSON.parse(JSON.stringify(board.posts[0])),id:mode,pov:mode,title:mode+' ONLY TITLE'});
          board.posts[0].title='world ONLY TITLE';
          t.state.view='list'; t.state.detail=null; t.render();
        });
        for(const mode of ['reader','drama','world','drama']) {
          const audience=mode!=='world';
          if(audience && !await page.locator('.pov-audience').count()) await page.locator('.pov-switch [data-act=pov-tab]').nth(1).click();
          await page.locator(`${audience ? '.pov-audience' : '.pov-switch'} [data-id=${mode}]`).click();
          await page.waitForFunction(expected=>window.communityTest.state.data.boards.room.identity.pov===expected,mode);
          assert.equal(await page.locator('.l-reddit .card').count(),1);
          assert((await page.locator('.l-reddit .r-title').innerText()).includes(mode+' ONLY TITLE'));
          const dimensions=await page.locator('.pov-nav').evaluate(nav=>({right:nav.getBoundingClientRect().right,buttons:[...nav.querySelectorAll('button')].map(b=>({width:b.getBoundingClientRect().width,right:b.getBoundingClientRect().right}))}));
          assert(dimensions.right<=width+1);
          assert(dimensions.buttons.every(b=>b.width>=44 && b.right<=width+1),'POV controls must fit viewport');
        }
        assert.equal(await page.evaluate(() => window.communityUiError || ''), '');
        console.log(`PASS POV tabs browser: ${width}px ${darkMode ? 'dark':'light'}, real world/reader/drama clicks, filtering and button bounds`);
        const themes={world:'gall',reader:'reddit',drama:'cafe'};
        for(const mode of ['world','reader','drama']) {
          if(mode!=='world' && !await page.locator('.pov-audience').count()) await page.locator('.pov-switch [data-act=pov-tab]').nth(1).click();
          await page.locator(`${mode==='world'?'.pov-switch':'.pov-audience'} [data-id=${mode}]`).click();
          await page.locator('[data-pov-theme]').selectOption(themes[mode]);
          await page.waitForFunction(theme=>document.querySelector('#'+window.communityTest.ROOT_ID).shadowRoot.querySelector('.app').dataset.theme===theme,themes[mode]);
          const select=await page.locator('[data-pov-theme]').evaluate(el=>({font:parseFloat(getComputedStyle(el).fontSize),right:el.getBoundingClientRect().right}));
          assert(select.font>=16 && select.right<=width+1,'Theme select must fit mobile without small focus font');
        }
        await page.evaluate(()=>{window.communityTest.state.connections=[{id:'test',name:'test'}]});
        await page.locator('.top [data-act=settings]').click();
        await page.locator('[data-tab-profile=boardName]').fill('DRAMA_BOARD_NAME');
        await page.locator('[data-tab-profile=boardName]').press('Tab');
        await page.waitForFunction(()=>window.communityTest.state.data.boards.room.povProfiles?.drama?.boardName==='DRAMA_BOARD_NAME');
        await page.locator('[data-tab-profile=rules]').fill('DRAMA_RULES_ONLY');
        await page.locator('[data-tab-profile=rules]').press('Tab');
        await page.waitForFunction(()=>window.communityTest.state.data.boards.room.povProfiles?.drama?.rules==='DRAMA_RULES_ONLY');
        await page.locator('.top [data-act=back]').click();
        await page.locator('.pov-switch [data-id=world]').click();
        assert.equal(await page.locator('[data-pov-theme]').inputValue(),'gall');
        await page.locator('.top [data-act=settings]').click();
        assert.equal(await page.locator('[data-tab-profile=rules]').inputValue(),'');
        assert.equal(await page.locator('[data-tab-profile=boardName]').inputValue(),'');
        await page.locator('.top [data-act=back]').click();
        await page.locator('.pov-switch [data-act=pov-tab]').nth(1).click();
        assert.equal(await page.locator('[data-pov-theme]').inputValue(),'cafe');
        assert.equal(await page.evaluate(()=>window.communityUiError || ''),'');
        console.log(`PASS tab themes/rules browser: ${width}px ${darkMode?'dark':'light'}, real selects, isolated native input changes, remembered theme`);
        await page.locator('.pov-switch [data-id=world]').click();
        await page.locator('.list [data-act=open]').first().click();
        const scopeSelect=page.locator('[data-post-pov]');
        assert.equal(await scopeSelect.inputValue(),'world');
        await scopeSelect.selectOption('reader');
        await page.waitForFunction(()=>window.communityTest.state.data.boards.room.posts.find(p=>p.id==='post').pov==='reader' && window.communityTest.state.view==='list');
        assert.equal(await page.locator('.list [data-act=open]').count(),0,'Moved post must leave world list');
        await page.locator('.pov-switch [data-act=pov-tab]').nth(1).click();
        await page.locator('.pov-audience [data-id=reader]').click();
        assert.equal(await page.locator('.list [data-act=open]').count(),2,'Moved post must appear in reader list');
        assert.equal(await page.evaluate(()=>window.communityTest.state.data.boards.room.posts.find(p=>p.id==='post').comments.length),1);
        assert.equal(await page.evaluate(()=>window.communityUiError || ''),'');
        console.log(`PASS post POV move browser: ${width}px ${darkMode?'dark':'light'}, real select and lossless list move`);
      }
    }
    await context.close();
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
