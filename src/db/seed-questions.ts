import { NewQuestion } from './schema'

export const seedQuestions: NewQuestion[] = [
  // General Knowledge
  {
    text: "What is the capital of France?",
    optionA: "London",
    optionB: "Berlin",
    optionC: "Paris",
    optionD: "Madrid",
    correctAnswer: "C",
    category: "geography",
    difficulty: 1,
    commentary: "Oui oui! Paris is indeed the city of love, croissants, and people who judge your pronunciation."
  },
  {
    text: "Which planet is known as the Red Planet?",
    optionA: "Venus",
    optionB: "Mars",
    optionC: "Jupiter",
    optionD: "Saturn",
    correctAnswer: "B",
    category: "science",
    difficulty: 1,
    commentary: "Mars gets its red color from iron oxide (rust) on its surface. It's basically a giant rusty ball in space!"
  },
  {
    text: "Who painted the Mona Lisa?",
    optionA: "Vincent van Gogh",
    optionB: "Pablo Picasso",
    optionC: "Leonardo da Vinci",
    optionD: "Michelangelo",
    correctAnswer: "C",
    category: "art",
    difficulty: 1,
    commentary: "Leonardo da Vinci spent 4 years on that smile. Some people can't even commit to a Netflix series that long!"
  },
  {
    text: "What is the largest mammal in the world?",
    optionA: "African Elephant",
    optionB: "Blue Whale",
    optionC: "Giraffe",
    optionD: "Polar Bear",
    correctAnswer: "B",
    category: "nature",
    difficulty: 1,
    commentary: "The blue whale's heart alone weighs as much as a car. Talk about wearing your heart on your... chassis?"
  },
  {
    text: "In which year did World War II end?",
    optionA: "1943",
    optionB: "1944",
    optionC: "1945",
    optionD: "1946",
    correctAnswer: "C",
    category: "history",
    difficulty: 2,
    commentary: "1945: The year the world collectively said 'Never again!' ...and then invented the Cold War."
  },

  // Pop Culture
  {
    text: "Which movie won the Academy Award for Best Picture in 2020?",
    optionA: "1917",
    optionB: "Joker",
    optionC: "Parasite",
    optionD: "Once Upon a Time in Hollywood",
    correctAnswer: "C",
    category: "entertainment",
    difficulty: 2,
    commentary: "Parasite made history as the first non-English film to win Best Picture. Subtitles: 1, Hollywood: 0!"
  },
  {
    text: "What is the name of the coffee shop in the TV show 'Friends'?",
    optionA: "Central Perk",
    optionB: "The Coffee Bean",
    optionC: "Starbucks",
    optionD: "Luke's Diner",
    correctAnswer: "A",
    category: "entertainment",
    difficulty: 1,
    commentary: "Central Perk: Where six friends somehow always got the same couch despite living in New York City."
  },

  // Science & Technology
  {
    text: "What does 'HTTP' stand for?",
    optionA: "HyperText Transfer Protocol",
    optionB: "High Tech Transfer Process",
    optionC: "Hyper Transfer Text Protocol",
    optionD: "Home Tool Transfer Protocol",
    correctAnswer: "A",
    category: "technology",
    difficulty: 2,
    commentary: "HTTP: The protocol that's been delivering cat videos to your screen since 1991!"
  },
  {
    text: "How many bones are in an adult human body?",
    optionA: "106",
    optionB: "206",
    optionC: "306",
    optionD: "406",
    correctAnswer: "B",
    category: "science",
    difficulty: 2,
    commentary: "206 bones, and somehow you still manage to hit your funny bone on everything!"
  },
  {
    text: "What is the speed of light in a vacuum?",
    optionA: "186,282 miles per second",
    optionB: "186,282 miles per hour",
    optionC: "299,792 kilometers per hour",
    optionD: "299,792 meters per second",
    correctAnswer: "A",
    category: "science",
    difficulty: 3,
    commentary: "186,282 miles per second: Fast enough to circle Earth 7.5 times in one second, yet your internet still lags!"
  },

  // Sports
  {
    text: "How many players are on a basketball team on the court at one time?",
    optionA: "4",
    optionB: "5",
    optionC: "6",
    optionD: "7",
    correctAnswer: "B",
    category: "sports",
    difficulty: 1,
    commentary: "5 players: Just enough to argue about who should take the last shot!"
  },
  {
    text: "In which sport would you perform a 'slam dunk'?",
    optionA: "Tennis",
    optionB: "Golf",
    optionC: "Basketball",
    optionD: "Baseball",
    correctAnswer: "C",
    category: "sports",
    difficulty: 1,
    commentary: "Slam dunk: The only move that sounds like both a basketball play and a breakfast order!"
  },

  // Food & Drink
  {
    text: "What is the main ingredient in guacamole?",
    optionA: "Tomato",
    optionB: "Avocado",
    optionC: "Lime",
    optionD: "Onion",
    correctAnswer: "B",
    category: "food",
    difficulty: 1,
    commentary: "Avocados: The fruit that millennials allegedly can't afford because they keep putting it on toast!"
  },
  {
    text: "Which country is the origin of the cocktail Mojito?",
    optionA: "Brazil",
    optionB: "Mexico",
    optionC: "Cuba",
    optionD: "Spain",
    correctAnswer: "C",
    category: "food",
    difficulty: 2,
    commentary: "Cuba gave us the Mojito: Proof that good things come from mixing mint, rum, and questionable decisions!"
  },

  // Literature
  {
    text: "Who wrote 'Romeo and Juliet'?",
    optionA: "Charles Dickens",
    optionB: "William Shakespeare",
    optionC: "Jane Austen",
    optionD: "Mark Twain",
    correctAnswer: "B",
    category: "literature",
    difficulty: 1,
    commentary: "Shakespeare: Teaching teenagers that communication is key in relationships since 1597!"
  },
  {
    text: "What is the first book in the Harry Potter series?",
    optionA: "The Chamber of Secrets",
    optionB: "The Prisoner of Azkaban",
    optionC: "The Philosopher's Stone",
    optionD: "The Goblet of Fire",
    correctAnswer: "C",
    category: "literature",
    difficulty: 1,
    commentary: "The Philosopher's Stone (or Sorcerer's Stone for Americans who apparently can't handle philosophy)!"
  },

  // Music
  {
    text: "Which instrument has 88 keys?",
    optionA: "Organ",
    optionB: "Accordion",
    optionC: "Piano",
    optionD: "Synthesizer",
    correctAnswer: "C",
    category: "music",
    difficulty: 1,
    commentary: "88 keys on a piano: 52 white ones you'll use, and 36 black ones that make you look fancy!"
  },
  {
    text: "Who is known as the 'King of Pop'?",
    optionA: "Elvis Presley",
    optionB: "Michael Jackson",
    optionC: "Prince",
    optionD: "Madonna",
    correctAnswer: "B",
    category: "music",
    difficulty: 1,
    commentary: "Michael Jackson: The man who made moonwalking look easier than regular walking!"
  },

  // More Challenging Questions
  {
    text: "What is the smallest country in the world by area?",
    optionA: "Monaco",
    optionB: "San Marino",
    optionC: "Vatican City",
    optionD: "Liechtenstein",
    correctAnswer: "C",
    category: "geography",
    difficulty: 2,
    commentary: "Vatican City: 0.17 square miles of pure holiness... and gift shops!"
  },
  {
    text: "Which element has the chemical symbol 'Au'?",
    optionA: "Silver",
    optionB: "Aluminum",
    optionC: "Gold",
    optionD: "Copper",
    correctAnswer: "C",
    category: "science",
    difficulty: 2,
    commentary: "Au comes from 'Aurum', Latin for gold. Because calling it 'G' would've been too easy!"
  },
  {
    text: "In Greek mythology, who is the god of the sea?",
    optionA: "Zeus",
    optionB: "Hades",
    optionC: "Apollo",
    optionD: "Poseidon",
    correctAnswer: "D",
    category: "mythology",
    difficulty: 2,
    commentary: "Poseidon: Lord of the seas, earthquakes, and really aggressive dolphins!"
  },
  {
    text: "What year was the first iPhone released?",
    optionA: "2005",
    optionB: "2006",
    optionC: "2007",
    optionD: "2008",
    correctAnswer: "C",
    category: "technology",
    difficulty: 2,
    commentary: "2007: The year humanity collectively decided that buttons were overrated!"
  },
  {
    text: "Which country has won the most FIFA World Cups?",
    optionA: "Germany",
    optionB: "Argentina",
    optionC: "Italy",
    optionD: "Brazil",
    correctAnswer: "D",
    category: "sports",
    difficulty: 2,
    commentary: "Brazil with 5 World Cups: They're basically the Avengers of soccer!"
  },
  {
    text: "What is the longest river in the world?",
    optionA: "Amazon River",
    optionB: "Nile River",
    optionC: "Yangtze River",
    optionD: "Mississippi River",
    correctAnswer: "B",
    category: "geography",
    difficulty: 2,
    commentary: "The Nile: 4,132 miles of 'Are we there yet?'"
  },
  {
    text: "How many hearts does an octopus have?",
    optionA: "1",
    optionB: "2",
    optionC: "3",
    optionD: "4",
    correctAnswer: "C",
    category: "nature",
    difficulty: 3,
    commentary: "Three hearts: One for the body, two for the gills. Still can't find love on dating apps though!"
  }
]