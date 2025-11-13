import puppeteer from 'puppeteer';

async function debugGameFlow() {
  console.log('Starting game flow debug with 2 players...\n');

  // Launch two browsers
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

  // Set viewport
  await page1.setViewport({ width: 800, height: 1000 });
  await page2.setViewport({ width: 800, height: 1000 });

  // Capture all console messages
  page1.on('console', msg => {
    const text = msg.text();
    // Filter out game state fetched logs
    if (!text.includes('Game state fetched')) {
      console.log(`[PLAYER 1 - ${msg.type()}]:`, text);
    }
  });
  page2.on('console', msg => {
    const text = msg.text();
    if (!text.includes('Game state fetched')) {
      console.log(`[PLAYER 2 - ${msg.type()}]:`, text);
    }
  });

  // Capture network errors
  page1.on('response', response => {
    if (!response.ok()) {
      console.log(`[PLAYER 1 - HTTP ERROR]: ${response.status()} ${response.url()}`);
    }
  });
  page2.on('response', response => {
    if (!response.ok()) {
      console.log(`[PLAYER 2 - HTTP ERROR]: ${response.status()} ${response.url()}`);
    }
  });

  // Capture page errors
  page1.on('pageerror', error => {
    console.log(`[PLAYER 1 - PAGE ERROR]:`, error.message);
  });
  page2.on('pageerror', error => {
    console.log(`[PLAYER 2 - PAGE ERROR]:`, error.message);
  });

  try {
    // PLAYER 1: Create game (host)
    console.log('\n=== PLAYER 1: Creating game ===');
    await page1.goto('https://trivia-app.jmorrison.workers.dev/game/create', { waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✓ Create page loaded');

    await page1.waitForSelector('input[type="text"]', { timeout: 10000 });
    console.log('✓ Form visible');

    await page1.type('input[type="text"]', 'Player 1 Host');
    await page1.click('button[type="submit"]');
    console.log('✓ Form submitted');

    // Wait for navigation to lobby
    await page1.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

    // Get room code from URL
    const url1 = page1.url();
    const roomCode = url1.match(/\/game\/([A-Z0-9]+)/)?.[1];
    console.log(`\n✓ Room created: ${roomCode}`);

    // PLAYER 2: Join game
    console.log('\n=== PLAYER 2: Joining game ===');
    await page2.goto('https://trivia-app.jmorrison.workers.dev/game/join');
    await page2.waitForSelector('input[type="text"]');

    // Find the room code input (should be first input)
    const inputs = await page2.$$('input[type="text"]');
    await inputs[0].type(roomCode);
    await inputs[1].type('Player 2');

    await page2.click('button[type="submit"]');
    await page2.waitForNavigation({ waitUntil: 'networkidle2' });
    console.log('✓ Player 2 joined lobby');

    // Wait a bit for both to be in lobby
    await new Promise(resolve => setTimeout(resolve, 2000));

    // PLAYER 1: Start the game
    console.log('\n=== PLAYER 1: Starting game ===');

    // Get actual game state being polled
    const gameState = await page1.evaluate(() => {
      return sessionStorage.getItem('isHost');
    });
    console.log('Player 1 isHost in sessionStorage:', gameState);

    // Wait for Start Game button to be enabled
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Try different selectors
    const allButtons = await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return buttons.map(b => ({
        text: b.innerText,
        disabled: b.disabled,
        classes: b.className
      }));
    });
    console.log('All buttons on page:', JSON.stringify(allButtons, null, 2));

    // Try to find and click start button
    const clicked = await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const startBtn = buttons.find(b => b.innerText.includes('Start Game'));
      if (startBtn && !startBtn.disabled) {
        startBtn.click();
        return true;
      }
      return false;
    });

    console.log('Start button clicked:', clicked);

    // Wait for navigation to play page
    console.log('\n=== Waiting for play page navigation ===');
    await Promise.all([
      page1.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log('Player 1 nav timeout:', e.message)),
      page2.waitForNavigation({ waitUntil: 'networkidle2', timeout: 10000 }).catch(e => console.log('Player 2 nav timeout:', e.message))
    ]);

    console.log('\n=== Current URLs ===');
    console.log('Player 1:', page1.url());
    console.log('Player 2:', page2.url());

    // Wait and check if we're on play page
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Check page content
    console.log('\n=== Checking page state ===');
    const p1Content = await page1.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        hasSpinner: !!document.querySelector('.animate-spin'),
        hasQuestion: document.body.innerText.includes('Question') || buttons.some(b => b.innerText === 'A' || b.innerText === 'B'),
        bodyText: document.body.innerText.substring(0, 500),
        buttonTexts: buttons.map(b => b.innerText).filter(t => t.length < 50)
      };
    });

    const p2Content = await page2.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      return {
        hasSpinner: !!document.querySelector('.animate-spin'),
        hasQuestion: document.body.innerText.includes('Question') || buttons.some(b => b.innerText === 'A' || b.innerText === 'B'),
        bodyText: document.body.innerText.substring(0, 500),
        buttonTexts: buttons.map(b => b.innerText).filter(t => t.length < 50)
      };
    });

    console.log('\nPlayer 1 state:', p1Content);
    console.log('Player 2 state:', p2Content);

    // Check WebSocket connections
    console.log('\n=== Checking WebSocket status ===');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n=== Test complete ===');
    console.log('Browsers will remain open for 30 seconds for manual inspection...');

    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser1.close();
    await browser2.close();
  }
}

debugGameFlow();
