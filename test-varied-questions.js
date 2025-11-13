import puppeteer from 'puppeteer';

async function testVariedQuestions() {
  console.log('Testing varied questions...\n');

  const browser1 = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  const browser2 = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page1 = await browser1.newPage();
  const page2 = await browser2.newPage();

  await page1.setViewport({ width: 1200, height: 1000 });
  await page2.setViewport({ width: 1200, height: 1000 });

  try {
    // Create and join game
    console.log('Setting up game...');
    await page1.goto('https://trivia-app.jmorrison.workers.dev/game/create', { waitUntil: 'networkidle2' });
    await page1.waitForSelector('input[type="text"]');
    await page1.type('input[type="text"]', 'Alice');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle2' });

    const roomCode = page1.url().match(/\/game\/([A-Z0-9]+)/)?.[1];
    console.log(`Room: ${roomCode}\n`);

    await page2.goto('https://trivia-app.jmorrison.workers.dev/game/join', { waitUntil: 'networkidle2' });
    await page2.waitForSelector('input[type="text"]');
    const inputs = await page2.$$('input[type="text"]');
    await inputs[0].type(roomCode);
    await inputs[1].type('Bob');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle2' });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start game
    await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.innerText.includes('Start Game'));
      if (startBtn) startBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));

    // Capture first 3 questions
    for (let i = 1; i <= 3; i++) {
      console.log(`\nQuestion ${i}:`);

      // Wait for question to load
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Get question text
      const questionText = await page1.evaluate(() => {
        const heading = document.querySelector('h1, h2, .text-2xl, .text-3xl');
        return heading ? heading.innerText : 'Question not found';
      });

      console.log(`  ${questionText}`);

      // Screenshot
      await page1.screenshot({ path: `screenshots/question-${i}.png` });
      console.log(`  ✓ Screenshot saved: question-${i}.png`);

      // Both players answer (answer A for simplicity)
      await page1.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.innerText.trim().startsWith('A'));
        if (answerBtn) answerBtn.click();
      });

      await page2.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.innerText.trim().startsWith('A'));
        if (answerBtn) answerBtn.click();
      });

      // Wait for next question (4 seconds for results + transition)
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('\n✅ Test complete! Check screenshots/ directory for varied questions.');

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

testVariedQuestions();
