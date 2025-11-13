import puppeteer from 'puppeteer';

async function testCompleteGame() {
  console.log('Testing complete game flow including results...\n');

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

  // Capture console errors
  page1.on('pageerror', error => {
    console.log(`[PLAYER 1 ERROR]:`, error.message);
  });
  page2.on('pageerror', error => {
    console.log(`[PLAYER 2 ERROR]:`, error.message);
  });

  try {
    // Create game
    console.log('✓ Creating game...');
    await page1.goto('https://trivia-app.jmorrison.workers.dev/game/create', { waitUntil: 'networkidle2' });
    await page1.waitForSelector('input[type="text"]');
    await page1.type('input[type="text"]', 'Alice');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle2' });

    const roomCode = page1.url().match(/\/game\/([A-Z0-9]+)/)?.[1];
    console.log(`✓ Room created: ${roomCode}`);

    // Join game
    console.log('✓ Player 2 joining...');
    await page2.goto('https://trivia-app.jmorrison.workers.dev/game/join', { waitUntil: 'networkidle2' });
    await page2.waitForSelector('input[type="text"]');
    const inputs = await page2.$$('input[type="text"]');
    await inputs[0].type(roomCode);
    await inputs[1].type('Bob');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✓ Player 2 joined');

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start game
    console.log('✓ Starting game...');
    await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.innerText.includes('Start Game'));
      if (startBtn) startBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 3000));
    console.log('✓ Game started, playing questions...');

    // Play through all 10 questions
    for (let i = 1; i <= 10; i++) {
      // Wait for question
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Both players answer (alternate between A and B)
      const answer = i % 2 === 0 ? 'A' : 'B';

      await page1.evaluate((ans) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.innerText.trim().startsWith(ans));
        if (answerBtn) answerBtn.click();
      }, answer);

      await page2.evaluate((ans) => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const answerBtn = buttons.find(b => b.innerText.trim().startsWith(ans));
        if (answerBtn) answerBtn.click();
      }, answer);

      console.log(`  ✓ Question ${i}/10 answered`);

      // Wait for results and next question
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    console.log('✓ All questions completed');

    // Wait for navigation to results page
    console.log('✓ Waiting for results page...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check if we're on results page
    const url1 = page1.url();
    const url2 = page2.url();
    console.log(`Player 1 URL: ${url1}`);
    console.log(`Player 2 URL: ${url2}`);

    if (url1.includes('/results') && url2.includes('/results')) {
      console.log('✓ Both players on results page');
    } else {
      console.log('⚠ Players not on results page yet, waiting more...');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    // Check for errors
    await new Promise(resolve => setTimeout(resolve, 2000));

    const page1Content = await page1.evaluate(() => {
      return {
        hasError: document.body.innerText.includes('Error') || document.body.innerText.includes('failed to fetch'),
        hasResults: document.body.innerText.includes('Final Leaderboard') || document.body.innerText.includes('Wins'),
        bodySnippet: document.body.innerText.substring(0, 300)
      };
    });

    const page2Content = await page2.evaluate(() => {
      return {
        hasError: document.body.innerText.includes('Error') || document.body.innerText.includes('failed to fetch'),
        hasResults: document.body.innerText.includes('Final Leaderboard') || document.body.innerText.includes('Wins'),
        bodySnippet: document.body.innerText.substring(0, 300)
      };
    });

    console.log('\n=== RESULTS CHECK ===');
    console.log('Player 1:');
    console.log('  Has Error:', page1Content.hasError);
    console.log('  Has Results:', page1Content.hasResults);
    console.log('  Preview:', page1Content.bodySnippet.replace(/\n/g, ' ').substring(0, 100));

    console.log('\nPlayer 2:');
    console.log('  Has Error:', page2Content.hasError);
    console.log('  Has Results:', page2Content.hasResults);
    console.log('  Preview:', page2Content.bodySnippet.replace(/\n/g, ' ').substring(0, 100));

    // Take screenshots
    await page1.screenshot({ path: 'screenshots/results-player1-test.png' });
    await page2.screenshot({ path: 'screenshots/results-player2-test.png' });
    console.log('\n✓ Screenshots saved');

    if (!page1Content.hasError && page1Content.hasResults && !page2Content.hasError && page2Content.hasResults) {
      console.log('\n✅ SUCCESS! Results page loaded correctly for both players!');
    } else if (page1Content.hasError || page2Content.hasError) {
      console.log('\n❌ FAILED! Error detected on results page');
    } else {
      console.log('\n⚠ WARNING! Results page might not have loaded correctly');
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

testCompleteGame();
