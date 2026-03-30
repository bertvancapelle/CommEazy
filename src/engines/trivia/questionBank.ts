/**
 * Trivia Question Bank — CommEazy
 *
 * Bundled starter questions in OpenTDB format.
 * Future: on-demand download per language via downloadService.
 *
 * Source: OpenTDB (CC BY-SA 4.0)
 * @see https://opentdb.com/
 */

import type { TriviaQuestion, TriviaDifficulty, TriviaTheme } from './types';

// ============================================================
// OpenTDB Category → Theme Mapping
// ============================================================

const CATEGORY_THEME_MAP: Record<string, TriviaTheme> = {
  'General Knowledge': 'general',
  'Entertainment: Books': 'arts',
  'Entertainment: Film': 'entertainment',
  'Entertainment: Music': 'entertainment',
  'Entertainment: Musicals & Theatres': 'arts',
  'Entertainment: Television': 'entertainment',
  'Entertainment: Video Games': 'entertainment',
  'Entertainment: Board Games': 'entertainment',
  'Entertainment: Comics': 'entertainment',
  'Entertainment: Japanese Anime & Manga': 'entertainment',
  'Entertainment: Cartoon & Animations': 'entertainment',
  'Science & Nature': 'science',
  'Science: Computers': 'science',
  'Science: Mathematics': 'science',
  'Science: Gadgets': 'science',
  'Mythology': 'arts',
  'Sports': 'sports',
  'Geography': 'history',
  'History': 'history',
  'Politics': 'history',
  'Art': 'arts',
  'Celebrities': 'entertainment',
  'Animals': 'animals',
  'Vehicles': 'animals',
};

/**
 * Map an OpenTDB category string to a broad theme
 */
export function mapCategoryToTheme(category: string): TriviaTheme {
  return CATEGORY_THEME_MAP[category] || 'general';
}

// ============================================================
// Bundled Starter Questions
// ============================================================

/**
 * Curated starter questions — enough for several rounds.
 * Designed for seniors: clear language, well-known topics.
 */
const BUNDLED_QUESTIONS: TriviaQuestion[] = [
  // === GENERAL KNOWLEDGE — Easy ===
  {
    id: 'gen-e-01',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'easy',
    question: 'How many days are there in a week?',
    correctAnswer: '7',
    incorrectAnswers: ['5', '6', '10'],
  },
  {
    id: 'gen-e-02',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'easy',
    question: 'What is the color of a ripe banana?',
    correctAnswer: 'Yellow',
    incorrectAnswers: ['Red', 'Blue', 'Green'],
  },
  {
    id: 'gen-e-03',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'easy',
    question: 'How many continents are there on Earth?',
    correctAnswer: '7',
    incorrectAnswers: ['5', '6', '8'],
  },
  {
    id: 'gen-e-04',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'easy',
    question: 'What do bees produce?',
    correctAnswer: 'Honey',
    incorrectAnswers: ['Milk', 'Sugar', 'Butter'],
  },
  {
    id: 'gen-e-05',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'easy',
    question: 'In which direction does the sun rise?',
    correctAnswer: 'East',
    incorrectAnswers: ['West', 'North', 'South'],
  },

  // === GENERAL KNOWLEDGE — Medium ===
  {
    id: 'gen-m-01',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'medium',
    question: 'How many bones are in the adult human body?',
    correctAnswer: '206',
    incorrectAnswers: ['186', '256', '312'],
  },
  {
    id: 'gen-m-02',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'medium',
    question: 'What is the chemical symbol for gold?',
    correctAnswer: 'Au',
    incorrectAnswers: ['Ag', 'Fe', 'Go'],
  },
  {
    id: 'gen-m-03',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'medium',
    question: 'Which planet is known as the Red Planet?',
    correctAnswer: 'Mars',
    incorrectAnswers: ['Venus', 'Jupiter', 'Saturn'],
  },

  // === GENERAL KNOWLEDGE — Hard ===
  {
    id: 'gen-h-01',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'hard',
    question: 'In what year did the Berlin Wall fall?',
    correctAnswer: '1989',
    incorrectAnswers: ['1987', '1991', '1985'],
  },
  {
    id: 'gen-h-02',
    category: 'General Knowledge',
    theme: 'general',
    difficulty: 'hard',
    question: 'What is the smallest country in the world by area?',
    correctAnswer: 'Vatican City',
    incorrectAnswers: ['Monaco', 'San Marino', 'Liechtenstein'],
  },

  // === SCIENCE & NATURE — Easy ===
  {
    id: 'sci-e-01',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'easy',
    question: 'What gas do plants absorb from the air?',
    correctAnswer: 'Carbon dioxide',
    incorrectAnswers: ['Oxygen', 'Nitrogen', 'Hydrogen'],
  },
  {
    id: 'sci-e-02',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'easy',
    question: 'What is the boiling point of water in Celsius?',
    correctAnswer: '100°C',
    incorrectAnswers: ['90°C', '110°C', '80°C'],
  },
  {
    id: 'sci-e-03',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'easy',
    question: 'How many legs does a spider have?',
    correctAnswer: '8',
    incorrectAnswers: ['6', '10', '4'],
  },

  // === SCIENCE — Medium ===
  {
    id: 'sci-m-01',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'medium',
    question: 'What is the closest planet to the Sun?',
    correctAnswer: 'Mercury',
    incorrectAnswers: ['Venus', 'Earth', 'Mars'],
  },
  {
    id: 'sci-m-02',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'medium',
    question: 'What is the hardest natural substance on Earth?',
    correctAnswer: 'Diamond',
    incorrectAnswers: ['Iron', 'Granite', 'Quartz'],
  },

  // === SCIENCE — Hard ===
  {
    id: 'sci-h-01',
    category: 'Science & Nature',
    theme: 'science',
    difficulty: 'hard',
    question: 'What is the powerhouse of the cell?',
    correctAnswer: 'Mitochondria',
    incorrectAnswers: ['Nucleus', 'Ribosome', 'Golgi apparatus'],
  },

  // === HISTORY & GEOGRAPHY — Easy ===
  {
    id: 'his-e-01',
    category: 'History',
    theme: 'history',
    difficulty: 'easy',
    question: 'What is the capital of France?',
    correctAnswer: 'Paris',
    incorrectAnswers: ['London', 'Berlin', 'Madrid'],
  },
  {
    id: 'his-e-02',
    category: 'Geography',
    theme: 'history',
    difficulty: 'easy',
    question: 'Which ocean is the largest?',
    correctAnswer: 'Pacific Ocean',
    incorrectAnswers: ['Atlantic Ocean', 'Indian Ocean', 'Arctic Ocean'],
  },
  {
    id: 'his-e-03',
    category: 'Geography',
    theme: 'history',
    difficulty: 'easy',
    question: 'What is the capital of the Netherlands?',
    correctAnswer: 'Amsterdam',
    incorrectAnswers: ['Rotterdam', 'The Hague', 'Utrecht'],
  },

  // === HISTORY — Medium ===
  {
    id: 'his-m-01',
    category: 'History',
    theme: 'history',
    difficulty: 'medium',
    question: 'Who painted the Mona Lisa?',
    correctAnswer: 'Leonardo da Vinci',
    incorrectAnswers: ['Michelangelo', 'Raphael', 'Rembrandt'],
  },
  {
    id: 'his-m-02',
    category: 'History',
    theme: 'history',
    difficulty: 'medium',
    question: 'In which year did World War II end?',
    correctAnswer: '1945',
    incorrectAnswers: ['1944', '1946', '1943'],
  },
  {
    id: 'his-m-03',
    category: 'Geography',
    theme: 'history',
    difficulty: 'medium',
    question: 'Which river flows through London?',
    correctAnswer: 'Thames',
    incorrectAnswers: ['Seine', 'Rhine', 'Danube'],
  },

  // === HISTORY — Hard ===
  {
    id: 'his-h-01',
    category: 'History',
    theme: 'history',
    difficulty: 'hard',
    question: 'Who was the first person to walk on the Moon?',
    correctAnswer: 'Neil Armstrong',
    incorrectAnswers: ['Buzz Aldrin', 'Yuri Gagarin', 'John Glenn'],
  },

  // === ARTS & CULTURE — Easy ===
  {
    id: 'art-e-01',
    category: 'Art',
    theme: 'arts',
    difficulty: 'easy',
    question: 'What are the three primary colors?',
    correctAnswer: 'Red, blue, yellow',
    incorrectAnswers: ['Red, green, blue', 'Red, yellow, green', 'Blue, yellow, green'],
  },
  {
    id: 'art-e-02',
    category: 'Entertainment: Music',
    theme: 'arts',
    difficulty: 'easy',
    question: 'How many strings does a standard guitar have?',
    correctAnswer: '6',
    incorrectAnswers: ['4', '8', '5'],
  },

  // === ARTS — Medium ===
  {
    id: 'art-m-01',
    category: 'Art',
    theme: 'arts',
    difficulty: 'medium',
    question: 'Who composed the "Four Seasons"?',
    correctAnswer: 'Antonio Vivaldi',
    incorrectAnswers: ['Johann Sebastian Bach', 'Wolfgang Amadeus Mozart', 'Ludwig van Beethoven'],
  },
  {
    id: 'art-m-02',
    category: 'Entertainment: Books',
    theme: 'arts',
    difficulty: 'medium',
    question: 'Who wrote "Romeo and Juliet"?',
    correctAnswer: 'William Shakespeare',
    incorrectAnswers: ['Charles Dickens', 'Jane Austen', 'Mark Twain'],
  },

  // === ENTERTAINMENT — Easy ===
  {
    id: 'ent-e-01',
    category: 'Entertainment: Film',
    theme: 'entertainment',
    difficulty: 'easy',
    question: 'What is the name of the fairy in Peter Pan?',
    correctAnswer: 'Tinker Bell',
    incorrectAnswers: ['Cinderella', 'Snow White', 'Ariel'],
  },
  {
    id: 'ent-e-02',
    category: 'Entertainment: Film',
    theme: 'entertainment',
    difficulty: 'easy',
    question: 'Which movie features a character named Simba?',
    correctAnswer: 'The Lion King',
    incorrectAnswers: ['Finding Nemo', 'Bambi', 'The Jungle Book'],
  },

  // === ENTERTAINMENT — Medium ===
  {
    id: 'ent-m-01',
    category: 'Entertainment: Television',
    theme: 'entertainment',
    difficulty: 'medium',
    question: 'In which city is the TV series "Friends" set?',
    correctAnswer: 'New York',
    incorrectAnswers: ['Los Angeles', 'Chicago', 'Boston'],
  },
  {
    id: 'ent-m-02',
    category: 'Entertainment: Music',
    theme: 'entertainment',
    difficulty: 'medium',
    question: 'Which band was John Lennon a member of?',
    correctAnswer: 'The Beatles',
    incorrectAnswers: ['The Rolling Stones', 'The Who', 'Led Zeppelin'],
  },

  // === ENTERTAINMENT — Hard ===
  {
    id: 'ent-h-01',
    category: 'Entertainment: Film',
    theme: 'entertainment',
    difficulty: 'hard',
    question: 'Who directed the movie "Schindler\'s List"?',
    correctAnswer: 'Steven Spielberg',
    incorrectAnswers: ['Martin Scorsese', 'Francis Ford Coppola', 'Ridley Scott'],
  },

  // === SPORTS — Easy ===
  {
    id: 'spo-e-01',
    category: 'Sports',
    theme: 'sports',
    difficulty: 'easy',
    question: 'How many players are on a football (soccer) team?',
    correctAnswer: '11',
    incorrectAnswers: ['9', '10', '12'],
  },
  {
    id: 'spo-e-02',
    category: 'Sports',
    theme: 'sports',
    difficulty: 'easy',
    question: 'In which sport do you use a racket and a shuttlecock?',
    correctAnswer: 'Badminton',
    incorrectAnswers: ['Tennis', 'Squash', 'Table Tennis'],
  },

  // === SPORTS — Medium ===
  {
    id: 'spo-m-01',
    category: 'Sports',
    theme: 'sports',
    difficulty: 'medium',
    question: 'In which country were the first modern Olympic Games held in 1896?',
    correctAnswer: 'Greece',
    incorrectAnswers: ['France', 'Italy', 'England'],
  },
  {
    id: 'spo-m-02',
    category: 'Sports',
    theme: 'sports',
    difficulty: 'medium',
    question: 'How many sets are needed to win a tennis match at Wimbledon (men)?',
    correctAnswer: '3 out of 5',
    incorrectAnswers: ['2 out of 3', '4 out of 7', '5 out of 9'],
  },

  // === ANIMALS — Easy ===
  {
    id: 'ani-e-01',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'easy',
    question: 'What is the largest animal on Earth?',
    correctAnswer: 'Blue whale',
    incorrectAnswers: ['Elephant', 'Giraffe', 'Hippopotamus'],
  },
  {
    id: 'ani-e-02',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'easy',
    question: 'What do caterpillars turn into?',
    correctAnswer: 'Butterflies',
    incorrectAnswers: ['Bees', 'Dragonflies', 'Ladybugs'],
  },
  {
    id: 'ani-e-03',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'easy',
    question: 'Which animal is known as the "King of the Jungle"?',
    correctAnswer: 'Lion',
    incorrectAnswers: ['Tiger', 'Elephant', 'Gorilla'],
  },

  // === ANIMALS — Medium ===
  {
    id: 'ani-m-01',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'medium',
    question: 'How many hearts does an octopus have?',
    correctAnswer: '3',
    incorrectAnswers: ['1', '2', '4'],
  },
  {
    id: 'ani-m-02',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'medium',
    question: 'Which bird is known for its ability to mimic human speech?',
    correctAnswer: 'Parrot',
    incorrectAnswers: ['Eagle', 'Penguin', 'Sparrow'],
  },

  // === ANIMALS — Hard ===
  {
    id: 'ani-h-01',
    category: 'Animals',
    theme: 'animals',
    difficulty: 'hard',
    question: 'What is the only mammal capable of true flight?',
    correctAnswer: 'Bat',
    incorrectAnswers: ['Flying squirrel', 'Sugar glider', 'Flying fox'],
  },
];

// ============================================================
// Query Functions
// ============================================================

/**
 * Get questions filtered by difficulty and theme
 */
export function getQuestions(
  difficulty: TriviaDifficulty,
  theme: TriviaTheme,
  count: number,
): TriviaQuestion[] {
  let pool = [...BUNDLED_QUESTIONS];

  // Filter by difficulty
  pool = pool.filter(q => q.difficulty === difficulty);

  // Filter by theme (unless 'mixed')
  if (theme !== 'mixed') {
    pool = pool.filter(q => q.theme === theme);
  }

  // Shuffle using Fisher-Yates
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // If we don't have enough questions in the filtered pool,
  // fill with questions from other themes at the same difficulty
  if (pool.length < count && theme !== 'mixed') {
    const fallback = BUNDLED_QUESTIONS
      .filter(q => q.difficulty === difficulty && q.theme !== theme)
      .sort(() => Math.random() - 0.5);

    const existing = new Set(pool.map(q => q.id));
    for (const q of fallback) {
      if (pool.length >= count) break;
      if (!existing.has(q.id)) {
        pool.push(q);
      }
    }
  }

  return pool.slice(0, count);
}

/**
 * Get the total number of available questions per difficulty
 */
export function getQuestionCounts(): Record<TriviaDifficulty, number> {
  return {
    easy: BUNDLED_QUESTIONS.filter(q => q.difficulty === 'easy').length,
    medium: BUNDLED_QUESTIONS.filter(q => q.difficulty === 'medium').length,
    hard: BUNDLED_QUESTIONS.filter(q => q.difficulty === 'hard').length,
  };
}
