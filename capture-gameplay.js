import puppeteer from 'puppeteer';

async function captureGameplay() {
  console.log('Starting gameplay capture...\n');

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
    // PLAYER 1: Create game
    console.log('Player 1: Creating game...');
    await page1.goto('https://trivia-app.jmorrison.workers.dev/game/create', { waitUntil: 'networkidle2' });
    await page1.waitForSelector('input[type="text"]');
    await page1.type('input[type="text"]', 'Alice');
    await page1.click('button[type="submit"]');
    await page1.waitForNavigation({ waitUntil: 'networkidle2' });

    const roomCode = page1.url().match(/\/game\/([A-Z0-9]+)/)?.[1];
    console.log(`Room created: ${roomCode}\n`);

    // Screenshot: Lobby (waiting for players)
    await new Promise(resolve => setTimeout(resolve, 1000));
    await page1.screenshot({ path: 'screenshots/01-lobby-host.png' });
    console.log('✓ Screenshot: 01-lobby-host.png');

    // PLAYER 2: Join game
    console.log('\nPlayer 2: Joining game...');
    await page2.goto('https://trivia-app.jmorrison.workers.dev/game/join', { waitUntil: 'networkidle2' });
    await page2.waitForSelector('input[type="text"]');
    const inputs = await page2.$$('input[type="text"]');
    await inputs[0].type(roomCode);
    await inputs[1].type('Bob');
    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle2' });

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Screenshot: Lobby with 2 players
    await page1.screenshot({ path: 'screenshots/02-lobby-both-players.png' });
    console.log('✓ Screenshot: 02-lobby-both-players.png');

    await page2.screenshot({ path: 'screenshots/03-lobby-player2-view.png' });
    console.log('✓ Screenshot: 03-lobby-player2-view.png');

    // PLAYER 1: Start game
    console.log('\nStarting game...');
    const startBtn = await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.innerText.includes('Start Game'));
      if (startBtn) {
        startBtn.click();
        return true;
      }
      return false;
    });

    if (startBtn) {
      console.log('✓ Start button clicked');
    }

    // Wait for navigation to play page
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('\nPlayer 1 URL:', page1.url());
    console.log('Player 2 URL:', page2.url());

    // Wait for question to load
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Screenshot: Question on play page
    await page1.screenshot({ path: 'screenshots/04-question-player1.png' });
    console.log('✓ Screenshot: 04-question-player1.png');

    await page2.screenshot({ path: 'screenshots/05-question-player2.png' });
    console.log('✓ Screenshot: 05-question-player2.png');

    // Player 1 answers
    console.log('\nPlayer 1 answering...');
    await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const answerBtn = buttons.find(b => b.innerText.startsWith('C'));
      if (answerBtn) answerBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 500));
    await page1.screenshot({ path: 'screenshots/06-player1-answered.png' });
    console.log('✓ Screenshot: 06-player1-answered.png');

    // Player 2 answers
    console.log('Player 2 answering...');
    await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const answerBtn = buttons.find(b => b.innerText.startsWith('C'));
      if (answerBtn) answerBtn.click();
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    // Wait for results
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Screenshot: Results showing
    await page1.screenshot({ path: 'screenshots/07-results-player1.png' });
    console.log('✓ Screenshot: 07-results-player1.png');

    await page2.screenshot({ path: 'screenshots/08-results-player2.png' });
    console.log('✓ Screenshot: 08-results-player2.png');

    console.log('\n✅ All screenshots captured successfully!');
    console.log('Screenshots saved to screenshots/ directory');

  } catch (error) {
    console.error('Error during capture:', error);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

captureGameplay();
