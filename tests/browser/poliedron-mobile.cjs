const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const root = path.resolve(__dirname, "../..");
const output =
  process.env.POLIEDRON_QA_OUTPUT ||
  path.join(os.tmpdir(), "poliedron-mobile-qa");
fs.mkdirSync(output, { recursive: true });
const harness = path.join(root, "__phone-qa.html");
fs.writeFileSync(
  harness,
  '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body><div id="root"></div><script type="module" src="/tests/fixtures/poliedron-phone-app.jsx"></script></body></html>',
);
const assert = require("assert/strict");
const { chromium: pw } = require("playwright");
(async () => {
  const launch = process.env.POLIEDRON_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.POLIEDRON_CHROMIUM_EXECUTABLE }
    : {};
  if (process.env.POLIEDRON_CHROMIUM_PACKAGE) {
    const { default: bin } = await import(
      process.env.POLIEDRON_CHROMIUM_PACKAGE
    );
    launch.args = bin.args;
  }
  const server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "5177",
      "--strictPort",
    ],
    { cwd: root, stdio: ["ignore", "pipe", "pipe"] },
  );
  let browser;
  try {
    await new Promise((resolve, reject) => {
      server.stdout.on("data", (x) => {
        if (x.toString().includes("Local:")) resolve();
      });
      server.on("exit", () => reject(Error("server exited")));
    });
    for (const [width, height] of [
      [320, 568],
      [375, 812],
      [390, 844],
      [430, 932],
      [844, 390],
      [768, 1024],
      [1024, 768],
      [1440, 900],
    ]) {
      browser = await pw.launch({ ...launch, headless: true });
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: width < 900,
        hasTouch: true,
        deviceScaleFactor: 1,
      });
      await context.route("**/*", (r) =>
        new URL(r.request().url()).hostname === "127.0.0.1"
          ? r.continue()
          : r.abort(),
      );
      const page = await context.newPage();
      await page.addInitScript(
        ({ height }) => {
          const v = {
            height: height,
            offsetTop: 0,
            scale: 1,
            addEventListener(t, fn) {
              window.addEventListener("qa-" + t, fn);
            },
            removeEventListener(t, fn) {
              window.removeEventListener("qa-" + t, fn);
            },
          };
          window.qaViewport = v;
          Object.defineProperty(window, "visualViewport", {
            value: v,
            configurable: true,
          });
        },
        { height },
      );
      await page.addInitScript(() => {
        window.SpeechRecognition = class {
          constructor() {
            window.qaSpeech = this;
          }
          start() {
            this.onstart?.();
          }
          stop() {
            this.onend?.();
          }
          abort() {
            this.onend?.();
          }
        };
      });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto("http://127.0.0.1:5177/__phone-qa.html");
      // WhatsApp-style: the app opens on the chat list; Poliedron is a chat.
      await page.getByRole("button", { name: "Chat con Poliedron" }).click();
      await page.locator(".poliedron-chat__message").last().waitFor();
      await page.waitForTimeout(200);
      const bounds = () =>
        page.evaluate(() => {
          const box = (s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return {
              top: r.top,
              bottom: r.bottom,
              left: r.left,
              right: r.right,
              height: r.height,
            };
          };
          return {
            shell: box(".app-shell"),
            header: box(".poliedron-chat__header"),
            composer: box(".poliedron-chat__composer"),
            list: box(".poliedron-chat__messages"),
            input: box("textarea"),
            width: innerWidth,
            height: visualViewport.height,
            overflow: document.documentElement.scrollWidth > innerWidth,
            font: getComputedStyle(document.querySelector("textarea")).fontSize,
          };
        });
      const b = await bounds();
      assert(!b.overflow, JSON.stringify(b));
      assert(Math.abs(b.composer.bottom - height) <= 1, JSON.stringify(b));
      assert(b.composer.left >= 0 && b.composer.right <= width + 1);
      assert(b.header.height <= 65);
      assert(b.list.height > 100);
      assert.equal(b.font, "16px");
      assert(await page.locator(".poliedron-chat__messages").evaluate(e => e.scrollWidth <= e.clientWidth), "Long text must wrap within the list");
      assert.equal(await page.locator(".poliedron-chat__date").count(), 2);
      const input = page.getByRole("textbox", {
        name: "Messaggio per Poliedron",
      });
      await input.fill("Una riga\n".repeat(25));
      let mult = await bounds();
      assert(mult.composer.bottom <= height + 1);
      assert(mult.input.height <= 121);
      await page.getByLabel("Opzioni chat").click();
      await page.getByRole("button", { name: "Registro attività" }).click();
      await page.getByText("Attività di Poliedron", { exact: true }).waitFor();
      await page.getByRole("button", { name: "Chiudi" }).click();
      await page.getByLabel("Opzioni chat").click();
      await page.keyboard.press("Escape");
      assert.equal(await page.locator("details").getAttribute("open"), null);
      if (width === 390) {
        await input.fill("Come posso organizzare meglio il lavoro?");
        await page.getByRole("button", { name: "Invia messaggio" }).tap();
        assert(await input.evaluate(e => document.activeElement === e), "Touch send must retain input focus");
        await page
          .locator(".poliedron-chat__bubble > div")
          .filter({ hasText: "Come posso organizzare meglio il lavoro?" })
          .waitFor();
        await page.waitForFunction(
          () => document.querySelector("textarea").value === "",
        );
        await input.fill("Bozza successiva");
        await page.waitForFunction(() => Boolean(window.qaRelease));
        await page.evaluate(() => window.qaRelease());
        await page
          .getByText("Risposta di prova verificata.", { exact: true })
          .waitFor();
        assert.equal(await input.inputValue(), "Bozza successiva");
        // VisualViewport simulation leaves layout viewport intact, like a keyboard.
        await page.evaluate(() => {
          window.qaViewport.height = 330;
          window.dispatchEvent(new Event("qa-resize"));
        });
        await page.waitForTimeout(150);
        const k = await bounds();
        assert(k.composer.bottom <= 331);
        assert(k.list.height > 80);
        assert(
          await page
            .locator(".poliedron-chat__messages")
            .evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight < 2),
          "Keyboard must keep latest message visible",
        );
        await page.screenshot({ path: path.join(output, "keyboard.png") });
        await page.evaluate(() => {
          Object.defineProperty(navigator, "onLine", {
            value: false,
            configurable: true,
          });
          window.dispatchEvent(new Event("offline"));
        });
        await page.getByText("Sei offline.", { exact: false }).waitFor();
        assert(
          await page
            .getByRole("button", { name: "Invia messaggio" })
            .isDisabled(),
        );
        assert.equal(await input.inputValue(), "Bozza successiva");
      }
      if (width === 375) {
        await input.fill("");
        await page.getByLabel("Detta messaggio").click();
        await page.evaluate(() =>
          window.qaSpeech.onresult({
            resultIndex: 0,
            results: [
              Object.assign([{ transcript: "Dettatura di prova" }], {
                isFinal: true,
              }),
            ],
          }),
        );
        await page.waitForFunction(
          () =>
            document.querySelector("textarea").value === "Dettatura di prova",
        );
        assert.equal(
          await page.locator(".poliedron-chat__message").count(),
          36,
        );
        await page.getByLabel("Termina dettatura").click();
        await page.getByLabel("Opzioni chat").click();
        await page
          .getByRole("button", { name: "Installa", exact: true })
          .click();
        await page
          .getByText("Poliedron sulla schermata Home", { exact: true })
          .waitFor();
        await page.getByRole("button", { name: "Chiudi", exact: true }).click();
        await page.keyboard.press("Escape");
        await page.getByLabel("Opzioni chat").click();
        await page
          .getByRole("button", { name: "Pazienti", exact: true })
          .click();
        await page
          .getByRole("button", { name: "← Torna a Poliedron", exact: true })
          .click();
        await page.getByRole("button", { name: "Chat con Poliedron" }).click();
        await page.locator(".poliedron-chat__message").last().waitFor();
        await input.fill("");
        await page.screenshot({ path: path.join(output, "phone.png") });
      }
      await page.locator(".poliedron-chat__messages").evaluate((e) => {
        e.scrollTop = 0;
        e.dispatchEvent(new Event("scroll"));
      });
      await page.getByLabel("Vai agli ultimi messaggi").click();
      assert.deepEqual(errors, []);
      console.log(
        `PASS full App ${width}x${height}: header, bounds, multiline, menu, activity, scroll${width === 390 ? ", send/persist/draft/offline/keyboard" : ""}`,
      );
      await browser.close();
      browser = null;
    }
    for (const scenario of ["empty", "error"]) {
      browser = await pw.launch({ ...launch, headless: true });
      const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      });
      await page.route("**/*", (r) =>
        new URL(r.request().url()).hostname === "127.0.0.1"
          ? r.continue()
          : r.abort(),
      );
      await page.addInitScript((value) => {
        window.__QA_SCENARIO__ = value;
      }, scenario);
      await page.goto("http://127.0.0.1:5177/__phone-qa.html");
      await page.getByRole("button", { name: "Chat con Poliedron" }).click();
      if (scenario === "empty")
        await page.locator('[data-state="empty"]').waitFor();
      else {
        await page
          .locator('.poliedron-chat__error[data-kind="schema"]')
          .waitFor();
        assert.equal(await page.locator('[data-state="empty"]').count(), 0);
      }
      console.log(`PASS full App ${scenario} state`);
      await browser.close();
      browser = null;
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
    fs.rmSync(harness, { force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
