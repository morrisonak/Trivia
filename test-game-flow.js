import puppeteer from 'puppeteer';

const BASE_URL = 'http://localhost:3003';

async function testGameFlow() {
  console.log('🎮 Starting Trivia Game Flow Test\n');

  // Launch two browsers for two players
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

  // Enable console logging
  page1.on('console', msg => console.log('Player 1 Console:', msg.text()));
  page2.on('console', msg => console.log('Player 2 Console:', msg.text()));

  // Enable error logging
  page1.on('pageerror', err => console.error('Player 1 Error:', err.message));
  page2.on('pageerror', err => console.error('Player 2 Error:', err.message));

  try {
    console.log('📍 Step 1: Player 1 creates a game...');
    await page1.goto(`${BASE_URL}/game/create`, { waitUntil: 'networkidle2' });

    // Wait for form to load
    await page1.waitForSelector('input[placeholder="Enter your name"]', { timeout: 5000 });

    // Fill out create game form
    await page1.type('input[placeholder="Enter your name"]', 'Player1');

    // Click on "15 Questions" button
    const buttons15 = await page1.$$('button');
    for (const button of buttons15) {
      const text = await button.evaluate(el => el.textContent);
      if (text.includes('15 Questions')) {
        await button.click();
        break;
      }
    }

    // Submit the form
    await page1.click('button[type="submit"]');

    // Wait for lobby page
    await page1.waitForSelector('.font-mono.font-bold.text-yellow-400', { timeout: 10000 });
    console.log('✅ Player 1 created game and entered lobby');

    // Extract room code
    const roomCode = await page1.evaluate(() => {
      const codeElement = document.querySelector('.font-mono.font-bold.text-yellow-400');
      return codeElement?.textContent.replace(/\s/g, '');
    });
    console.log(`📋 Room Code: ${roomCode}\n`);

    console.log('📍 Step 2: Player 2 joins the game...');
    await page2.goto(`${BASE_URL}/game/join`, { waitUntil: 'networkidle2' });

    // Wait for form
    await page2.waitForSelector('input[placeholder="Enter your name"]', { timeout: 5000 });

    // Fill out join form
    await page2.type('input[placeholder="Enter your name"]', 'Player2');
    await page2.type('input[placeholder="AB 12"]', roomCode);
    await page2.click('button[type="submit"]');

    // Wait for lobby
    await page2.waitForSelector('.font-mono.font-bold.text-yellow-400', { timeout: 10000 });
    console.log('✅ Player 2 joined game and entered lobby\n');

    // Wait a bit for polling to sync
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('📍 Step 3: Player 1 starts the game...');

    // Check current URL before starting
    const urlBeforeStart = await page1.url();
    console.log('Player 1 URL before start:', urlBeforeStart);

    // Start the game - wait for the button to be enabled
    await page1.waitForSelector('button:not(:disabled)', { timeout: 5000 });
    const buttons = await page1.$$('button');
    let startButton = null;
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent);
      if (text.includes('Start Game')) {
        startButton = button;
        break;
      }
    }

    if (startButton) {
      await startButton.click();
      console.log('✅ Start button clicked\n');
    } else {
      throw new Error('Start Game button not found');
    }

    // Wait and monitor what happens
    console.log('📍 Step 4: Monitoring navigation...');

    // Set up navigation monitoring
    let navigationHappened = false;
    page1.on('framenavigated', (frame) => {
      if (frame === page1.mainFrame()) {
        navigationHappened = true;
        console.log('Player 1 navigated to:', frame.url());
      }
    });

    page2.on('framenavigated', (frame) => {
      if (frame === page2.mainFrame()) {
        console.log('Player 2 navigated to:', frame.url());
      }
    });

    // Wait for navigation to play page - both players independently
    try {
      // Wait for both to navigate
      await Promise.all([
        page1.waitForFunction(() => window.location.href.includes('/play'), { timeout: 15000 }),
        page2.waitForFunction(() => window.location.href.includes('/play'), { timeout: 15000 })
      ]);

      //Give a moment for the page to stabilize
      await new Promise(resolve => setTimeout(resolve, 1000));

      const url1 = await page1.url();
      const url2 = await page2.url();

      console.log('Player 1 final URL:', url1);
      console.log('Player 2 final URL:', url2);

      if (url1.includes('/play') && url2.includes('/play')) {
        console.log('✅ SUCCESS: Both players navigated to play page!');
        console.log('⏳ Waiting for questions to load...');

        // Wait for question buttons to appear (means question is loaded)
        try {
          await Promise.all([
            page1.waitForFunction(() => {
              const buttons = document.querySelectorAll('button');
              for (const btn of buttons) {
                if (btn.textContent.includes('A') && btn.textContent.length > 10) {
                  return true;
                }
              }
              return false;
            }, { timeout: 20000 }),
            page2.waitForFunction(() => {
              const buttons = document.querySelectorAll('button');
              for (const btn of buttons) {
                if (btn.textContent.includes('A') && btn.textContent.length > 10) {
                  return true;
                }
              }
              return false;
            }, { timeout: 20000 })
          ]);
          console.log('✅ Questions loaded for both players!');

          // Wait a second for full render
          await new Promise(resolve => setTimeout(resolve, 1000));

          // Player 1 clicks answer A
          console.log('📍 Player 1 answering question...');
          const answerButtons = await page1.$$('button');
          for (const button of answerButtons) {
            const text = await button.evaluate(el => el.textContent);
            if (text.includes('A') && text.length > 10) {
              await button.click();
              console.log('✅ Player 1 clicked answer A');
              break;
            }
          }

          // Wait for answer to be processed
          await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (err) {
          console.log('⚠️  Questions may still be loading...');
          console.log('Error:', err.message);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }

        // Take screenshots
        await page1.screenshot({ path: 'screenshots/player1-success.png', fullPage: true });
        await page2.screenshot({ path: 'screenshots/player2-success.png', fullPage: true });
        console.log('📸 Screenshots saved to screenshots/ directory');
      } else {
        console.log('❌ FAILED: Players did not navigate to play page');
        console.log('Expected URLs to contain "/play"');

        // Take failure screenshots
        await page1.screenshot({ path: 'screenshots/player1-failure.png', fullPage: true });
        await page2.screenshot({ path: 'screenshots/player2-failure.png', fullPage: true });
      }
    } catch (err) {
      console.log('❌ Navigation timeout - checking current state...');
      const url1 = await page1.url();
      const url2 = await page2.url();
      console.log('Player 1 URL:', url1);
      console.log('Player 2 URL:', url2);

      // Check session storage
      const sessionStorage1 = await page1.evaluate(() => {
        return {
          playerId: sessionStorage.getItem('playerId'),
          playerName: sessionStorage.getItem('playerName'),
          navigatedToPlay: sessionStorage.getItem('navigatedToPlay')
        };
      });
      console.log('Player 1 session storage:', sessionStorage1);
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    console.log('\n🏁 Test complete, closing browsers...');
    await browser1.close();
    await browser2.close();
  }
}

testGameFlow().catch(console.error);
