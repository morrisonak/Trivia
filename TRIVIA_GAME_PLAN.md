# MVP Trivia Game - Implementation Plan (D1 Edition)

## Project Overview

A web-based trivia game with personality-driven humor designed for group play with an optional shared "big screen" display. The game supports both traditional online play (everyone on their own devices) and living room party mode (with TV display enhancement).

### Core Value Proposition
- **Quick Match Format**: 3-5 minute games with 2-4 participants
- **Dual Display Mode**: Players use phones/tablets as controllers, optional TV/monitor shows enhanced visuals
- **Real-time Synchronization**: Sub-100ms latency for seamless multiplayer experience
- **Humor-Driven Content**: Witty commentary and personality similar to "You Don't Know Jack"

## Technical Architecture

### Stack Overview
- **Frontend**: TanStack Start (React 19) with TypeScript
- **UI Components**: Shadcn/ui + Tailwind CSS v4
- **Backend**: Cloudflare Workers with API routes
- **Real-time**: Durable Objects for stateful game rooms
- **Database**: Cloudflare D1 (SQLite)
- **State Management**: TanStack Query
- **Forms**: TanStack Form
- **Deployment**: Cloudflare Workers

### System Architecture
```
┌─────────────────┐     ┌─────────────────┐
│  Player Client  │     │  Big Board      │
│   (Mobile/Web)  │     │  (TV Display)   │
└────────┬────────┘     └────────┬────────┘
         │                       │
         └───────────┬───────────┘
                     │
              WebSocket/HTTP
                     │
         ┌───────────▼───────────┐
         │  Cloudflare Worker    │
         │    (API Routes)       │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Durable Object      │
         │    (GameRoom)         │
         └───────────┬───────────┘
                     │
         ┌───────────▼───────────┐
         │   Cloudflare D1       │
         │   (SQLite Database)   │
         └───────────────────────┘
```

## Database Schema (D1)

### Core Tables

```sql
-- Questions table: Store all trivia questions
CREATE TABLE questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK(correct_answer IN ('A', 'B', 'C', 'D')),
    category TEXT DEFAULT 'general',
    difficulty INTEGER DEFAULT 1 CHECK(difficulty BETWEEN 1 AND 3),
    commentary TEXT, -- Humorous explanation shown after answer
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
);

-- Games table: Track game sessions
CREATE TABLE games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_code TEXT UNIQUE NOT NULL,
    host_player_id TEXT NOT NULL,
    status TEXT DEFAULT 'lobby' CHECK(status IN ('lobby', 'playing', 'finished')),
    max_players INTEGER DEFAULT 4,
    question_count INTEGER DEFAULT 10,
    time_per_question INTEGER DEFAULT 15,
    created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    started_at TEXT,
    ended_at TEXT
);

-- Game players: Track participants
CREATE TABLE game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_name TEXT NOT NULL,
    connection_id TEXT UNIQUE,
    is_host INTEGER DEFAULT 0,
    is_display INTEGER DEFAULT 0, -- Big Board connection
    score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'connected',
    joined_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (game_id) REFERENCES games(id)
);

-- Game questions: Questions selected for each game
CREATE TABLE game_questions (
    game_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    question_order INTEGER NOT NULL,
    asked_at TEXT,
    PRIMARY KEY (game_id, question_id),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Player answers: Track responses and scoring
CREATE TABLE player_answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    answer TEXT CHECK(answer IN ('A', 'B', 'C', 'D')),
    is_correct INTEGER DEFAULT 0,
    points_earned INTEGER DEFAULT 0,
    time_taken_ms INTEGER,
    answered_at TEXT DEFAULT (CURRENT_TIMESTAMP),
    FOREIGN KEY (game_id) REFERENCES games(id),
    FOREIGN KEY (player_id) REFERENCES game_players(id),
    FOREIGN KEY (question_id) REFERENCES questions(id)
);

-- Create indexes for performance
CREATE INDEX idx_games_room_code ON games(room_code);
CREATE INDEX idx_game_players_game_id ON game_players(game_id);
CREATE INDEX idx_game_questions_game_id ON game_questions(game_id);
CREATE INDEX idx_player_answers_game_player ON player_answers(game_id, player_id);
```

## Implementation Timeline

### Week 1-2: Foundation (Core Infrastructure)

#### Tasks
- [x] Set up TanStack Start project with Cloudflare Workers
- [ ] Configure D1 database with schema
- [ ] Create Durable Object for GameRoom
- [ ] Implement basic WebSocket connection handling
- [ ] Set up development environment with wrangler

#### Deliverables
- Working D1 database with tables created
- Basic Durable Object that accepts WebSocket connections
- Project structure with routing configured
- Development workflow established

### Week 3-4: Game Mechanics (Player Experience)

#### Tasks
- [ ] Build room creation flow (generate 4-character codes)
- [ ] Implement player joining mechanism
- [ ] Create question delivery system
- [ ] Add answer submission and validation
- [ ] Build scoring algorithm
- [ ] Implement game state transitions

#### Deliverables
- Functional game loop (create → join → play → results)
- Player client with full gameplay
- Real-time score updates
- Timer synchronization

### Week 5-6: Big Board Addition (Enhanced Display)

#### Tasks
- [ ] Create Big Board client variant
- [ ] Implement special display connection type
- [ ] Build enhanced visualizations
- [ ] Add player status indicators
- [ ] Create animated transitions
- [ ] Design TV-optimized layouts

#### Deliverables
- Separate Big Board client application
- Connection handling for display role
- Enhanced visual presentations
- Synchronized animations

### Week 7-8: Polish & Testing (Production Ready)

#### Tasks
- [ ] Handle edge cases (disconnections, rejoining)
- [ ] Optimize WebSocket message payload
- [ ] Add error handling and recovery
- [ ] Performance testing and optimization
- [ ] Load testing with multiple concurrent games
- [ ] UI/UX polish and refinements

#### Deliverables
- Production-ready application
- Performance metrics achieved
- Comprehensive error handling
- Deployment to Cloudflare Workers

## Project Structure

```
trivia/
├── src/
│   ├── routes/
│   │   ├── index.tsx                    # Landing page
│   │   ├── game/
│   │   │   ├── create.tsx              # Create new game
│   │   │   ├── join.tsx                # Join existing game
│   │   │   └── [roomCode].tsx          # Player game client
│   │   ├── display/
│   │   │   └── [roomCode].tsx          # Big Board display
│   │   └── api/
│   │       ├── games.ts                # Game CRUD operations
│   │       ├── questions.ts            # Question management
│   │       └── websocket.ts            # WebSocket upgrade
│   ├── components/
│   │   ├── game/
│   │   │   ├── QuestionDisplay.tsx     # Question presentation
│   │   │   ├── AnswerButtons.tsx       # Answer selection UI
│   │   │   ├── Timer.tsx               # Countdown timer
│   │   │   ├── ScoreBoard.tsx         # Score display
│   │   │   └── PlayerList.tsx         # Lobby player list
│   │   ├── display/
│   │   │   ├── BigBoardQuestion.tsx   # TV-optimized question
│   │   │   ├── PlayerStatus.tsx       # Status indicators
│   │   │   └── Leaderboard.tsx        # Enhanced leaderboard
│   │   └── ui/                        # Shadcn components
│   ├── lib/
│   │   ├── game-state.ts              # Game state management
│   │   ├── websocket-client.ts        # WebSocket utilities
│   │   ├── room-codes.ts              # Room code generation
│   │   └── scoring.ts                 # Scoring algorithms
│   └── db/
│       ├── schema.ts                  # Drizzle schema
│       ├── queries.ts                 # Database queries
│       └── seed-questions.ts          # Initial questions
├── durable-objects/
│   └── GameRoom.ts                    # Stateful game room
├── migrations/                         # D1 migrations
├── server-entry.ts                    # Cloudflare entry point
├── wrangler.jsonc                     # Cloudflare config
└── drizzle.config.ts                  # Drizzle ORM config
```

## API Specification

### REST Endpoints

```typescript
// Game Management
POST   /api/games/create         // Create new game room
POST   /api/games/join          // Join existing game
GET    /api/games/:id           // Get game state
POST   /api/games/:id/start     // Start game (host only)
DELETE /api/games/:id           // End game (host only)

// Question Management
GET    /api/questions/random    // Get random questions for game
POST   /api/questions           // Add new question (admin)

// Player Actions
POST   /api/games/:id/answer   // Submit answer
GET    /api/games/:id/results  // Get final results
```

### WebSocket Messages

```typescript
// Client → Server Messages
interface ClientMessage {
  type: 'join' | 'answer' | 'start_game' | 'heartbeat';
  payload: any;
}

// Server → Client Messages
interface ServerMessage {
  type: 'game_state' | 'question' | 'answer_result' |
        'player_joined' | 'player_left' | 'game_ended' |
        'timer_sync' | 'scores_update';
  payload: any;
}

// Example Message Flows
→ { type: 'join', payload: { playerName: 'Alice', isDisplay: false }}
← { type: 'game_state', payload: { players: [...], status: 'lobby' }}

→ { type: 'answer', payload: { questionId: 1, answer: 'B' }}
← { type: 'answer_result', payload: { correct: true, points: 100 }}
```

## Game Flow Specifications

### 1. Room Creation
```mermaid
Player → Create Room → Generate 4-char code → Return room details
                          ↓
                    Store in D1
                          ↓
                 Create Durable Object
```

### 2. Joining Process
```mermaid
Player → Enter Code → Validate → Join Room → Update Player List
           ↓                        ↓              ↓
    Big Board (optional)      WebSocket      Broadcast to all
```

### 3. Game Loop
```mermaid
Lobby → Start Game → Load Questions → For Each Question:
                                          ↓
                                    Show Question (15s)
                                          ↓
                                    Collect Answers
                                          ↓
                                    Reveal Correct
                                          ↓
                                    Update Scores
                                          ↓
                                    Next/End Game
```

### 4. Display Synchronization
- All clients receive same game state via WebSocket broadcast
- Big Board receives enhanced presentation data
- Players receive interactive elements
- Timer runs client-side but synchronized from server
- Score updates animate differently on each display type

## Feature Specifications

### Player Client Features
- **Responsive Design**: Mobile-first, works on all devices
- **Touch Optimized**: Large touch targets for answer selection
- **Real-time Updates**: Instant feedback on answers
- **Personal Stats**: Individual score and ranking
- **Network Resilient**: Auto-reconnect on connection loss

### Big Board Features
- **TV Optimization**: Large fonts readable from 10+ feet
- **Enhanced Animations**: Dramatic reveals and transitions
- **Player Indicators**: Show who's answered, who's thinking
- **Leaderboard Display**: Podium-style final rankings
- **Ambient Mode**: Attractive lobby display while waiting

### Game Mechanics
- **Question Timer**: 15 seconds per question (configurable)
- **Scoring Algorithm**:
  - Base points: 100 per correct answer
  - Speed bonus: (15 - seconds_taken) * 10
  - Streak bonus: 50 points for 3+ correct in a row
- **Game Length**: 10 questions (configurable)
- **Player Limit**: 2-4 players per game

## Performance Requirements

### Technical Metrics
- **Latency**: < 100ms synchronization between clients
- **Concurrent Games**: Support 100+ active games
- **Connection Stability**: Handle intermittent disconnections
- **Load Time**: < 2s initial page load
- **Response Time**: < 50ms for answer submission

### Scalability Targets
- **Phase 1 (MVP)**: 100 concurrent games, 400 active players
- **Phase 2**: 1,000 concurrent games, 4,000 active players
- **Phase 3**: 10,000 concurrent games, 40,000 active players

## Security Considerations

### Authentication & Authorization
- No user accounts required (anonymous play)
- Room codes are temporary and expire
- Host privileges for game control
- Rate limiting on room creation

### Data Validation
- Server-side answer validation
- Timer enforcement on server
- Sanitize all user inputs (names, etc.)
- Prevent duplicate answers

### Anti-Cheat Measures
- Server authoritative for all game logic
- Questions not sent until needed
- Answers validated server-side
- Time tracking for suspicious patterns

## Testing Strategy

### Unit Testing
- Game logic functions
- Scoring algorithms
- State management
- Database queries

### Integration Testing
- WebSocket connection flows
- Multi-client synchronization
- Database operations
- API endpoints

### Load Testing
- Simulate 100 concurrent games
- Test with varying network conditions
- Measure response times under load
- Test Big Board disconnect scenarios

### User Testing
- Living room play sessions
- Online multiplayer testing
- Mobile device testing
- TV browser compatibility

## Deployment Strategy

### Environment Setup
```bash
# Development
npm run dev                 # Local development with D1

# Database
npm run db:generate        # Generate migrations
npm run db:push           # Apply migrations to D1

# Production
npm run build             # Build for production
npm run deploy           # Deploy to Cloudflare Workers
```

### Configuration
```json
// wrangler.jsonc
{
  "name": "trivia-game",
  "main": "./server-entry.ts",
  "compatibility_date": "2024-01-01",
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "trivia-db",
      "database_id": "YOUR_DATABASE_ID"
    }
  ],
  "durable_objects": {
    "bindings": [
      {
        "name": "GAME_ROOM",
        "class_name": "GameRoom"
      }
    ]
  }
}
```

## Post-MVP Enhancements

### Phase 2 Features
- User accounts and profiles
- Custom question packs
- Tournament mode
- Spectator mode
- Mobile app with native features
- Voice chat integration

### Phase 3 Features
- AI-generated questions
- Dynamic difficulty adjustment
- Team play mode
- Themed game rooms
- Achievement system
- Global leaderboards

### Monetization Options
- Premium question packs
- Ad-supported free tier
- Private room hosting
- Custom branding for events
- Subscription for unlimited play

## Risk Analysis & Mitigation

### Technical Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| WebSocket instability | High | Implement reconnection logic and state recovery |
| D1 performance limits | Medium | Cache frequently accessed data, optimize queries |
| Browser compatibility | Medium | Progressive enhancement, fallback options |
| Durable Object limits | High | Implement room recycling and cleanup |

### User Experience Risks
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Confusing dual-display setup | High | Clear onboarding, visual indicators |
| Network lag affecting gameplay | High | Client prediction, generous time windows |
| Small mobile touch targets | Medium | Responsive design, touch-optimized UI |
| TV browser limitations | Medium | Feature detection, graceful degradation |

## Success Metrics

### MVP Launch (Month 1)
- [ ] 100 games played daily
- [ ] 50% game completion rate
- [ ] 30% Big Board adoption
- [ ] < 2% technical error rate

### Growth Phase (Month 3)
- [ ] 1,000 games played daily
- [ ] 60% returning players
- [ ] 40% Big Board adoption
- [ ] 4.0+ app store rating

### Maturity (Month 6)
- [ ] 10,000 games played daily
- [ ] 70% returning players
- [ ] 50% using social features
- [ ] Revenue positive

## Development Resources

### Documentation
- [TanStack Start Docs](https://tanstack.com/start)
- [Cloudflare D1 Docs](https://developers.cloudflare.com/d1)
- [Durable Objects Guide](https://developers.cloudflare.com/workers/learning/using-durable-objects)
- [Drizzle ORM Docs](https://orm.drizzle.team)

### Tools & Libraries
- **Database GUI**: `npm run db:studio`
- **Type Generation**: `npm run db:generate`
- **Component Library**: `npx shadcn@latest add [component]`
- **Testing**: Vitest for unit tests
- **Deployment**: Wrangler CLI

### Team Responsibilities
- **Frontend**: Player/Big Board clients, UI/UX
- **Backend**: API, WebSocket, game logic
- **Database**: Schema, queries, optimization
- **DevOps**: Deployment, monitoring, scaling

## Conclusion

This MVP focuses on proving the core multiplayer trivia experience with optional Big Board enhancement. The architecture supports both online and living room play modes while maintaining simplicity and performance. The use of Cloudflare's edge infrastructure ensures low latency and global scalability.

The phased approach allows for iterative development and testing, with clear success metrics at each stage. The technical stack leverages modern tools while remaining pragmatic about complexity and maintenance burden.

Key to success will be nailing the real-time synchronization, maintaining humor and personality in the content, and ensuring the Big Board truly enhances rather than complicates the experience.