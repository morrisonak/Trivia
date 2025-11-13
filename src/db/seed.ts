import { drizzle } from 'drizzle-orm/d1'
import { questions } from './schema'
import { seedQuestions } from './seed-questions'

export async function seedDatabase(DB: D1Database) {
  const db = drizzle(DB)

  console.log('🌱 Seeding database with questions...')

  try {
    // Check if questions already exist
    const existingQuestions = await db.select().from(questions).limit(1)

    if (existingQuestions.length > 0) {
      console.log('✅ Database already contains questions, skipping seed')
      return
    }

    // Insert seed questions
    for (const question of seedQuestions) {
      await db.insert(questions).values(question)
    }

    console.log(`✅ Successfully seeded ${seedQuestions.length} questions`)
  } catch (error) {
    console.error('❌ Error seeding database:', error)
    throw error
  }
}