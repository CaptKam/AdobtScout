import { faker } from "@faker-js/faker";
import { db } from "../db";
import {
  users, userProfiles, shelterProfiles, ownerProfiles,
  dogs, swipes, chatMessages, conversations, messages
} from "@shared/schema";
import { sql } from "drizzle-orm";

// Seed for reproducibility
const SEED = 12345;
faker.seed(SEED);

// ============================================
// DATA CONSTANTS
// ============================================

const DOG_BREEDS = [
  "Labrador Retriever", "Golden Retriever", "German Shepherd", "Beagle",
  "Bulldog", "Poodle", "Rottweiler", "Yorkshire Terrier", "Boxer",
  "Dachshund", "Siberian Husky", "Pembroke Welsh Corgi", "Australian Shepherd",
  "Great Dane", "Doberman Pinscher", "Miniature Schnauzer", "Border Collie",
  "Chihuahua", "Pomeranian", "Shih Tzu", "Boston Terrier", "Pit Bull Mix",
  "Cocker Spaniel", "French Bulldog", "Maltese", "Jack Russell Terrier",
  "Mixed Breed", "Labrador Mix", "Shepherd Mix", "Terrier Mix"
];

const TEMPERAMENTS = [
  "friendly", "playful", "calm", "loyal", "gentle", "protective",
  "energetic", "affectionate", "intelligent", "independent"
];

const DOG_NAMES = [
  "Max", "Bella", "Charlie", "Luna", "Cooper", "Daisy", "Rocky", "Lucy",
  "Buddy", "Sadie", "Duke", "Molly", "Bear", "Lola", "Tucker", "Sophie",
  "Oliver", "Chloe", "Winston", "Penny", "Murphy", "Zoe", "Riley", "Stella",
  "Bailey", "Maggie", "Zeus", "Rosie", "Bentley", "Ruby", "Scout", "Milo",
  "Ace", "Roxy", "Leo", "Willow", "Finn", "Ellie", "Jax", "Piper"
];

const SHELTER_NAMES = [
  // Austin Area Shelters
  "Austin Pets Alive!", "Texas Humane Heroes", "Bluebonnet Animal Shelter",
  "Hill Country Rescue", "Lone Star Dog Sanctuary", "Capitol City Canines",
  "Round Rock Paws", "Cedar Park Animal Care", "Georgetown Rescue Ranch",
  "San Marcos Pet Haven", "Central Texas SPCA", "Austin Animal Center",

  // Dallas Area Shelters
  "Dallas Pets Alive", "Operation Kindness", "Dallas Dog RRR",
  "SPCA of Texas", "DFW Rescue Me", "Paws in the City",
  "Plano Animal Shelter", "Irving Animal Services", "Frisco Humane Society",
  "McKinney Animal Shelter", "Arlington Animal Services", "Denton County Friends",
  "Richardson Animal Shelter", "Garland Animal Services", "North Texas Pet Rescue",
  "Metroplex Animal Coalition", "Fort Worth Humane", "Tarrant County Pets"
];

const US_CITIES = [
  // Austin Metro Area
  { city: "Austin", state: "TX", lat: 30.2672, lng: -97.7431 },
  { city: "Round Rock", state: "TX", lat: 30.5083, lng: -97.6789 },
  { city: "Cedar Park", state: "TX", lat: 30.5052, lng: -97.8203 },
  { city: "Pflugerville", state: "TX", lat: 30.4394, lng: -97.6200 },
  { city: "Georgetown", state: "TX", lat: 30.6327, lng: -97.6779 },
  { city: "San Marcos", state: "TX", lat: 29.8833, lng: -97.9414 },
  { city: "Kyle", state: "TX", lat: 29.9893, lng: -97.8772 },
  { city: "Buda", state: "TX", lat: 30.0852, lng: -97.8403 },
  { city: "Leander", state: "TX", lat: 30.5788, lng: -97.8531 },
  { city: "Lakeway", state: "TX", lat: 30.3588, lng: -97.9778 },

  // Dallas-Fort Worth Metro Area
  { city: "Dallas", state: "TX", lat: 32.7767, lng: -96.7970 },
  { city: "Fort Worth", state: "TX", lat: 32.7555, lng: -97.3308 },
  { city: "Plano", state: "TX", lat: 32.9857, lng: -96.6989 },
  { city: "Irving", state: "TX", lat: 32.8140, lng: -96.9489 },
  { city: "Frisco", state: "TX", lat: 33.1507, lng: -96.8236 },
  { city: "McKinney", state: "TX", lat: 33.1972, lng: -96.6397 },
  { city: "Arlington", state: "TX", lat: 32.7357, lng: -97.1081 },
  { city: "Denton", state: "TX", lat: 33.2148, lng: -97.1331 },
  { city: "Richardson", state: "TX", lat: 32.9483, lng: -96.7299 },
  { city: "Garland", state: "TX", lat: 32.9126, lng: -96.6389 },
  { city: "Carrollton", state: "TX", lat: 32.9537, lng: -96.8903 },
  { city: "Allen", state: "TX", lat: 33.1031, lng: -96.6706 }
];

const DOG_BIOS = [
  "A lovable companion who enjoys cuddles and playtime. Looking for a family to call my own!",
  "I'm a bundle of joy who loves everyone I meet. Ready to bring happiness to your home!",
  "Loyal and affectionate, I promise to be your best friend. Let's go on adventures together!",
  "Sweet-natured and gentle, I'm great with families. Can't wait to meet you!",
  "Playful and energetic, I love the outdoors. Looking for an active family!",
  "Calm and well-mannered, I'm perfect for a relaxed home. Ready for my forever family!",
  "Smart and eager to please, I learn quickly. Let's train together and have fun!",
  "Affectionate cuddle bug who loves being close to people. Will you be my human?",
  "Gentle soul with a big heart. I promise to fill your days with love!",
  "Energetic and fun-loving, I'm always ready for an adventure. Let's explore together!"
];

// ============================================
// HELPER FUNCTIONS
// ============================================

function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomChoices<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function addLatLngOffset(lat: number, lng: number): { lat: number; lng: number } {
  const latOffset = (Math.random() - 0.5) * 0.2; // ~11 miles
  const lngOffset = (Math.random() - 0.5) * 0.2;
  return { lat: lat + latOffset, lng: lng + lngOffset };
}

function getSizeFromWeight(weight: number): string {
  if (weight < 25) return "small";
  if (weight < 60) return "medium";
  return "large";
}

function getAgeCategoryFromAge(age: number): string {
  if (age < 1) return "puppy";
  if (age < 3) return "young";
  if (age < 8) return "adult";
  return "senior";
}

// ============================================
// DATA GENERATORS
// ============================================

async function generateAdopters(count: number) {
  console.log(`Generating ${count} adopters...`);
  const adoptersData = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    const city = randomChoice(US_CITIES);
    const location = addLatLngOffset(city.lat, city.lng);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      firstName,
      lastName,
      role: "adopter",
      profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    }).returning();

    // Create user profile with varied preferences
    await db.insert(userProfiles).values({
      userId: user.id,
      homeType: randomChoice(["house", "apartment", "condo"]),
      hasYard: Math.random() > 0.5,
      hasOtherPets: Math.random() > 0.6,
      otherPetsType: Math.random() > 0.5 ? randomChoice(["dogs", "cats", "both", "other"]) : null,
      activityLevel: randomChoice(["very_active", "active", "moderate", "relaxed"]),
      workSchedule: randomChoice(["home_all_day", "hybrid", "office_full_time", "varies"]),
      exerciseCommitment: randomChoice(["multiple_daily", "daily", "few_times_week", "occasional"]),
      experienceLevel: randomChoice(["first_time", "some_experience", "very_experienced"]),
      preferredSize: randomChoices(["small", "medium", "large"], randomInt(1, 3)),
      preferredAge: randomChoices(["puppy", "young", "adult", "senior"], randomInt(1, 3)),
      preferredEnergy: randomChoices(["low", "moderate", "high", "very_high"], randomInt(1, 3)),
      latitude: location.lat,
      longitude: location.lng,
      searchRadius: randomChoice([10, 25, 50, 100]),
    });

    adoptersData.push({ user, city });
  }

  console.log(`✓ Created ${count} adopters`);
  return adoptersData;
}

async function generateShelters(count: number) {
  console.log(`Generating ${count} shelters...`);
  const sheltersData = [];

  for (let i = 0; i < count; i++) {
    const shelterName = i < SHELTER_NAMES.length ? SHELTER_NAMES[i] : faker.company.name() + " Animal Shelter";
    const city = randomChoice(US_CITIES);
    const email = `contact@${shelterName.toLowerCase().replace(/\s+/g, '')}.org`;

    // Create user
    const [user] = await db.insert(users).values({
      email,
      firstName: shelterName.split(' ')[0],
      lastName: "Shelter",
      role: "shelter",
      profileImageUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${shelterName}`,
    }).returning();

    // Create shelter profile
    await db.insert(shelterProfiles).values({
      userId: user.id,
      shelterName,
      location: `${city.city}, ${city.state}`,
      email,
      phone: faker.phone.number(),
      licenseNumber: `SHL-${randomInt(10000, 99999)}`,
      description: `A compassionate animal rescue dedicated to finding loving homes for dogs in need. Serving the ${city.city} area since ${randomInt(2000, 2020)}.`,
      isVerified: Math.random() > 0.3, // 70% verified
    });

    sheltersData.push({ user, shelterName, city });
  }

  console.log(`✓ Created ${count} shelters`);
  return sheltersData;
}

async function generateOwners(count: number) {
  console.log(`Generating ${count} individual owners...`);
  const ownersData = [];

  for (let i = 0; i < count; i++) {
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    const email = faker.internet.email({ firstName, lastName }).toLowerCase();
    const city = randomChoice(US_CITIES);

    // Create user
    const [user] = await db.insert(users).values({
      email,
      firstName,
      lastName,
      role: "owner",
      profileImageUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`,
    }).returning();

    // Create owner profile
    const reasons = [
      "Moving to a new apartment that doesn't allow pets",
      "New baby in the family and need to find a good home",
      "Work schedule changed and can't give proper attention",
      "Allergies developed in the family",
      "Moving overseas for work",
      "Downsizing to a smaller home"
    ];

    await db.insert(ownerProfiles).values({
      userId: user.id,
      fullName: `${firstName} ${lastName}`,
      location: `${city.city}, ${city.state}`,
      email,
      phone: faker.phone.number(),
      reason: randomChoice(reasons),
    });

    ownersData.push({ user, fullName: `${firstName} ${lastName}`, city });
  }

  console.log(`✓ Created ${count} owners`);
  return ownersData;
}

async function generateDogsForShelter(shelter: any, dogsPerShelter: number) {
  const dogsData = [];

  for (let i = 0; i < dogsPerShelter; i++) {
    const age = randomInt(0, 12);
    const weight = randomInt(10, 120);
    const breed = randomChoice(DOG_BREEDS);
    const name = randomChoice(DOG_NAMES);
    const energyLevel = randomChoice(["low", "moderate", "high", "very_high"]);
    const location = addLatLngOffset(shelter.city.lat, shelter.city.lng);

    const dogData = {
      userId: shelter.user.id,
      name,
      breed,
      age,
      ageCategory: getAgeCategoryFromAge(age),
      size: getSizeFromWeight(weight),
      weight,
      energyLevel,
      temperament: randomChoices(TEMPERAMENTS, randomInt(2, 4)),
      goodWithKids: Math.random() > 0.3,
      goodWithDogs: Math.random() > 0.4,
      goodWithCats: Math.random() > 0.5,
      bio: randomChoice(DOG_BIOS),
      specialNeeds: Math.random() > 0.8 ? "Requires daily medication for arthritis" : null,
      photos: [
        `https://placedog.net/640/480?random=${faker.number.float()}`,
        `https://placedog.net/640/480?random=${faker.number.float()}`,
        `https://placedog.net/640/480?random=${faker.number.float()}`
      ],
      shelterId: shelter.user.id,
      shelterName: shelter.shelterName,
      shelterAddress: `${faker.location.streetAddress()}, ${shelter.city.city}, ${shelter.city.state}`,
      shelterPhone: faker.phone.number(),
      latitude: location.lat,
      longitude: location.lng,
      vaccinated: Math.random() > 0.2,
      spayedNeutered: Math.random() > 0.3,
    };

    const [dog] = await db.insert(dogs).values(dogData).returning();
    dogsData.push(dog);
  }

  return dogsData;
}

async function generateDogsForOwner(owner: any, dogsPerOwner: number) {
  const dogsData = [];

  for (let i = 0; i < dogsPerOwner; i++) {
    const age = randomInt(1, 10);
    const weight = randomInt(15, 90);
    const breed = randomChoice(DOG_BREEDS);
    const name = randomChoice(DOG_NAMES);
    const energyLevel = randomChoice(["low", "moderate", "high", "very_high"]);
    const location = addLatLngOffset(owner.city.lat, owner.city.lng);

    const dogData = {
      userId: owner.user.id,
      name,
      breed,
      age,
      ageCategory: getAgeCategoryFromAge(age),
      size: getSizeFromWeight(weight),
      weight,
      energyLevel,
      temperament: randomChoices(TEMPERAMENTS, randomInt(2, 4)),
      goodWithKids: Math.random() > 0.2,
      goodWithDogs: Math.random() > 0.3,
      goodWithCats: Math.random() > 0.4,
      bio: randomChoice(DOG_BIOS),
      specialNeeds: Math.random() > 0.9 ? "Requires special diet" : null,
      photos: [
        `https://placedog.net/640/480?random=${faker.number.float()}`,
        `https://placedog.net/640/480?random=${faker.number.float()}`
      ],
      shelterId: owner.user.id,
      shelterName: `${owner.fullName} (Owner)`,
      shelterAddress: `${faker.location.streetAddress()}, ${owner.city.city}, ${owner.city.state}`,
      shelterPhone: faker.phone.number(),
      latitude: location.lat,
      longitude: location.lng,
      vaccinated: Math.random() > 0.1,
      spayedNeutered: Math.random() > 0.2,
    };

    const [dog] = await db.insert(dogs).values(dogData).returning();
    dogsData.push(dog);
  }

  return dogsData;
}

async function generateSwipesForAdopter(adopter: any, allDogs: any[], swipesPerUser: number) {
  const shuffledDogs = [...allDogs].sort(() => Math.random() - 0.5);
  const dogsToSwipe = shuffledDogs.slice(0, Math.min(swipesPerUser, allDogs.length));

  for (const dog of dogsToSwipe) {
    // 60% right, 40% left
    const direction = Math.random() > 0.4 ? "right" : "left";

    await db.insert(swipes).values({
      userId: adopter.user.id,
      dogId: dog.id,
      direction,
    });
  }
}

async function generateChatMessagesForAdopter(adopter: any, allDogs: any[]) {
  // Generate 3-8 chat messages per adopter
  const messageCount = randomInt(3, 8);
  const dogReferences = randomChoices(allDogs, Math.min(2, allDogs.length));

  const userMessages = [
    "I'm looking for a dog that's good with kids",
    "What kind of dog would fit my active lifestyle?",
    "Tell me more about Golden Retrievers",
    "I want a medium-sized dog that doesn't shed much",
    "What's the best dog for first-time owners?",
  ];

  const assistantResponses = [
    "Based on your profile, I'd recommend looking at dogs with moderate energy levels and gentle temperaments.",
    "I found several great matches for you! Let me show you some dogs that fit your lifestyle.",
    "That's a wonderful breed! They're known for being friendly and great with families.",
    "I understand you're looking for something specific. Let me help you find the perfect match.",
    "Great question! For first-time owners, I usually recommend dogs that are eager to please and adaptable.",
  ];

  for (let i = 0; i < messageCount; i++) {
    if (i % 2 === 0) {
      // User message
      await db.insert(chatMessages).values({
        userId: adopter.user.id,
        role: "user",
        content: randomChoice(userMessages),
        dogContext: Math.random() > 0.7 ? randomChoice(dogReferences)?.id : null,
      });
    } else {
      // Assistant message
      await db.insert(chatMessages).values({
        userId: adopter.user.id,
        role: "assistant",
        content: randomChoice(assistantResponses),
        dogContext: Math.random() > 0.7 ? randomChoice(dogReferences)?.id : null,
      });
    }
  }
}

async function generateConversationsForAdopter(adopter: any, likedDogs: any[]) {
  // Create 1-3 conversations for dogs they liked
  const conversationCount = Math.min(randomInt(1, 3), likedDogs.length);
  const dogsToMessage = randomChoices(likedDogs, conversationCount);

  for (const dog of dogsToMessage) {
    const [conversation] = await db.insert(conversations).values({
      userId: adopter.user.id,
      dogId: dog.id,
      shelterName: dog.shelterName,
    }).returning();

    // Generate 2-5 messages per conversation
    const messageCount = randomInt(2, 5);
    const userQuestions = [
      "Hi! I'm interested in learning more about this dog.",
      "What's their daily routine like?",
      "Are they crate trained?",
      "Can I schedule a meet and greet?",
      "Do they have any special requirements?",
    ];

    const shelterResponses = [
      "Thank you for your interest! We'd be happy to tell you more.",
      "They're doing great and love their daily walks!",
      "Yes, they're fully crate trained and house trained.",
      "Absolutely! When would work best for you?",
      "Just lots of love and regular exercise!",
    ];

    for (let i = 0; i < messageCount; i++) {
      const isUserMessage = i % 2 === 0;
      await db.insert(messages).values({
        conversationId: conversation.id,
        senderId: isUserMessage ? adopter.user.id : "shelter",
        senderType: isUserMessage ? "user" : "shelter",
        content: isUserMessage ? randomChoice(userQuestions) : randomChoice(shelterResponses),
      });
    }
  }
}

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log("🌱 Starting fake data generation...\n");

  try {
    // Step 0: Clear existing data
    console.log("Clearing existing data...");
    await db.delete(messages);
    await db.delete(conversations);
    await db.delete(chatMessages);
    await db.delete(swipes);
    await db.delete(dogs);
    await db.delete(userProfiles);
    await db.delete(shelterProfiles);
    await db.delete(ownerProfiles);
    await db.delete(users);
    console.log("✓ Cleared all existing data\n");

    // Step 1: Generate adopters
    const adopters = await generateAdopters(40);

    // Step 2: Generate shelters
    const shelters = await generateShelters(12);

    // Step 3: Generate owners
    const owners = await generateOwners(15);

    // Step 4: Generate dogs for shelters (5-12 dogs per shelter)
    console.log("\nGenerating dogs for shelters...");
    const allDogs = [];
    for (const shelter of shelters) {
      const dogsCount = randomInt(5, 12);
      const shelterDogs = await generateDogsForShelter(shelter, dogsCount);
      allDogs.push(...shelterDogs);
      console.log(`  ✓ Created ${dogsCount} dogs for ${shelter.shelterName}`);
    }

    // Step 5: Generate dogs for owners (1-2 dogs per owner)
    console.log("\nGenerating dogs for owners...");
    for (const owner of owners) {
      const dogsCount = randomInt(1, 2);
      const ownerDogs = await generateDogsForOwner(owner, dogsCount);
      allDogs.push(...ownerDogs);
      console.log(`  ✓ Created ${dogsCount} dog(s) for ${owner.fullName}`);
    }

    console.log(`\n✓ Total dogs created: ${allDogs.length}`);

    // Step 6: Generate swipes for adopters
    console.log("\nGenerating swipes for adopters...");
    for (const adopter of adopters) {
      const swipesCount = randomInt(20, 30);
      await generateSwipesForAdopter(adopter, allDogs, swipesCount);
    }
    console.log(`✓ Created swipes for ${adopters.length} adopters`);

    // Step 7: Generate chat messages for some adopters
    console.log("\nGenerating Scout AI chat messages...");
    const adoptersWithChat = randomChoices(adopters, Math.floor(adopters.length * 0.6));
    for (const adopter of adoptersWithChat) {
      await generateChatMessagesForAdopter(adopter, allDogs);
    }
    console.log(`✓ Created chat messages for ${adoptersWithChat.length} adopters`);

    // Step 8: Generate conversations for some adopters
    console.log("\nGenerating user-shelter conversations...");
    for (const adopter of adopters) {
      // Get dogs this adopter liked
      const adopterSwipes = await db
        .select()
        .from(swipes)
        .where(sql`${swipes.userId} = ${adopter.user.id} AND ${swipes.direction} = 'right'`)
        .limit(10);

      if (adopterSwipes.length > 0) {
        const likedDogIds = adopterSwipes.map(s => s.dogId);
        const likedDogs = allDogs.filter(d => likedDogIds.includes(d.id));

        if (likedDogs.length > 0) {
          await generateConversationsForAdopter(adopter, likedDogs);
        }
      }
    }
    console.log(`✓ Created conversations and messages`);

    console.log("\n✅ Fake data generation complete!");
    console.log("\n📊 Summary:");
    console.log(`   - ${adopters.length} adopters`);
    console.log(`   - ${shelters.length} shelters`);
    console.log(`   - ${owners.length} owners`);
    console.log(`   - ${allDogs.length} dogs`);
    console.log(`   - ~${adopters.length * 25} swipes`);
    console.log(`   - ~${adoptersWithChat.length * 5} chat messages`);

  } catch (error) {
    console.error("❌ Error generating fake data:", error);
    throw error;
  }
}

// Run the seed function
main()
  .then(() => {
    console.log("\n✨ Done!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });