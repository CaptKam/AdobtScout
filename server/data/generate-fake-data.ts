import type { InsertDog, InsertUserProfile, InsertShelterProfile } from "@shared/schema";

// Expanded dog names pool
const dogNames = [
  "Bailey", "Max", "Luna", "Charlie", "Daisy", "Cooper", "Lucy", "Buddy", "Sadie", "Rocky",
  "Molly", "Bear", "Maggie", "Duke", "Bella", "Zeus", "Sophie", "Milo", "Chloe", "Jack",
  "Lola", "Oliver", "Penny", "Leo", "Rosie", "Tucker", "Ruby", "Teddy", "Zoey", "Winston",
  "Stella", "Harley", "Lily", "Bentley", "Nala", "Gus", "Willow", "Finn", "Ellie", "Jax",
  "Piper", "Oscar", "Maya", "Toby", "Gracie", "Archie", "Athena", "Murphy", "Coco", "Jasper",
  "Scout", "Remi", "Ace", "Pepper", "Bruno", "Winnie", "Thor", "Hazel", "Apollo", "Nova",
  "Ranger", "Sage", "Diesel", "Maple", "Hunter", "Moose", "Kona", "Aspen", "River", "Oakley",
  "Shadow", "Angel", "Storm", "Honey", "King", "Princess", "Chief", "Lady", "Rex", "Queenie",
  "Bandit", "Misty", "Rusty", "Buttercup", "Tank", "Peaches", "Maverick", "Sweetie", "Blue", "Snowball",
  "Ace", "Roxy", "Samson", "Duchess", "Cash", "Ginger", "Brody", "Sugar", "Knox", "Cookie"
];

// Breed pools
const smallBreeds = [
  "Chihuahua", "Pomeranian", "Yorkshire Terrier", "Shih Tzu", "Pug", "Dachshund",
  "French Bulldog", "Boston Terrier", "Cavalier King Charles Spaniel", "Maltese",
  "Papillon", "Toy Poodle", "Brussels Griffon", "Miniature Pinscher", "Italian Greyhound",
  "Chinese Crested", "Havanese", "Pekingese", "Japanese Chin", "Affenpinscher"
];

const mediumBreeds = [
  "Beagle", "Cocker Spaniel", "Border Collie", "Australian Shepherd", "Corgi", "Bulldog",
  "Terrier Mix", "Spaniel Mix", "Schnauzer", "Shiba Inu", "Basset Hound", "Whippet",
  "Brittany", "English Springer Spaniel", "Australian Cattle Dog", "Shetland Sheepdog",
  "Portuguese Water Dog", "Standard Schnauzer", "Wire Fox Terrier", "Staffordshire Terrier"
];

const largeBreeds = [
  "Labrador Retriever", "Golden Retriever", "German Shepherd", "Husky", "Rottweiler",
  "Boxer", "Great Dane", "Doberman", "Bernese Mountain Dog", "Pit Bull Mix",
  "Mastiff", "Saint Bernard", "Newfoundland", "Great Pyrenees", "Akita", "Malamute",
  "Rhodesian Ridgeback", "Weimaraner", "Vizsla", "Irish Setter", "Bloodhound"
];

const temperamentOptions = [
  ["friendly", "playful", "loyal"],
  ["energetic", "playful", "friendly", "loyal"],
  ["calm", "gentle", "affectionate"],
  ["intelligent", "protective", "loyal"],
  ["friendly", "affectionate", "gentle"],
  ["playful", "curious", "energetic"],
  ["loyal", "protective", "calm"],
  ["gentle", "affectionate", "calm", "friendly"],
  ["independent", "intelligent", "calm"],
  ["social", "playful", "friendly", "energetic"],
  ["mellow", "sweet", "loyal"],
  ["brave", "confident", "loyal"],
];

// Austin TX coordinates (scattered around the city and suburbs)
const austinLocations = [
  { lat: 30.2672, lng: -97.7431 }, // Downtown
  { lat: 30.2849, lng: -97.7341 }, // East Austin
  { lat: 30.3072, lng: -97.7531 }, // North Austin
  { lat: 30.2500, lng: -97.7500 }, // South Austin
  { lat: 30.3500, lng: -97.7000 }, // Round Rock
  { lat: 30.2200, lng: -97.8100 }, // West Lake Hills
  { lat: 30.4000, lng: -97.7200 }, // Pflugerville
  { lat: 30.2000, lng: -97.6500 }, // Del Valle
  { lat: 30.3300, lng: -97.8000 }, // Cedar Park
  { lat: 30.2900, lng: -97.6900 }, // Mueller
  { lat: 30.5100, lng: -97.6789 }, // Georgetown
  { lat: 30.1900, lng: -97.8700 }, // Dripping Springs
  { lat: 30.4200, lng: -97.7500 }, // North Loop
  { lat: 30.2300, lng: -97.7200 }, // Travis Heights
  { lat: 30.3800, lng: -97.7300 }, // Domain
];

const shelterNames = [
  "Happy Tails Rescue", "Second Chance Animal Shelter", "Paws & Hearts Adoption Center",
  "Austin Pet Rescue", "Forever Home Foundation", "Loving Paws Sanctuary",
  "Hope for Hounds", "Central Texas Dog Rescue", "Hill Country Humane Society",
  "Bluebonnet Animal Haven", "Texas Rescue Rangers", "Wagging Tails Shelter",
  "Capital City Canine Rescue", "Austin Animal Alliance", "Lone Star Dog Sanctuary",
  "Guardian Angel Pet Rescue", "New Beginning Dog Center", "Compassionate Paws",
  "Sunshine Dog Rescue", "Rainbow Bridge Animal Shelter"
];

const dogPhotos = [
  "/attached_assets/generated_images/Friendly_rescue_beagle_portrait_112fadd6.png",
  "/attached_assets/generated_images/Playful_chocolate_lab_action_shot_83731287.png",
  "/attached_assets/generated_images/Small_terrier_mix_portrait_c4f97286.png",
  "/attached_assets/generated_images/German_shepherd_mix_resting_897ecb63.png",
  "/attached_assets/generated_images/Senior_corgi_portrait_e324e761.png",
];

function randomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, array.length));
}

// Helper function to get consistent photos based on a unique ID
function getConsistentPhotos(dogId: string, count: number): string[] {
  const photos = [];
  for (let i = 0; i < count; i++) {
    // Use a hash of the dogId and index to pick a photo consistently
    const photoIndex = (hashString(dogId + i) % dogPhotos.length);
    photos.push(dogPhotos[photoIndex]);
  }
  return photos;
}

// Simple string hashing function
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}


export function generateFakeShelters(): InsertShelterProfile[] {
  const shelters: InsertShelterProfile[] = [];

  for (let i = 0; i < 20; i++) {
    const location = randomItem(austinLocations);
    const shelterName = shelterNames[i] || `${randomItem(["Happy", "Loving", "Caring", "Kind"])} ${randomItem(["Paws", "Tails", "Hearts", "Friends"])} ${randomItem(["Rescue", "Shelter", "Haven", "Sanctuary"])}`;

    shelters.push({
      userId: `shelter-user-${i + 1}`,
      shelterName,
      location: `${randomItem(["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown"])}, TX`,
      email: `contact@${shelterName.toLowerCase().replace(/\s+/g, '')}.org`,
      phone: `(512) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      licenseNumber: Math.random() > 0.3 ? `TX-${randomInt(10000, 99999)}` : null,
      description: `${shelterName} is dedicated to rescuing and rehoming dogs in the Central Texas area. We provide comprehensive care, medical treatment, and behavioral support to help every dog find their perfect match.`,
      isVerified: Math.random() > 0.2,
    });
  }

  return shelters;
}

export function generateFakeDogs(shelterCount: number = 20): InsertDog[] {
  const dogs: InsertDog[] = [];
  const usedNames = new Set<string>();

  // Generate 100 dogs distributed across shelters
  for (let i = 0; i < 100; i++) {
    let name = randomItem(dogNames);
    let attempts = 0;
    while (usedNames.has(name) && attempts < 50) {
      name = randomItem(dogNames);
      attempts++;
    }
    if (attempts >= 50) {
      name = `${name}${randomInt(1, 99)}`;
    }
    usedNames.add(name);

    const size = randomItem(["small", "medium", "large"]);
    const breed = size === "small" ? randomItem(smallBreeds) :
                  size === "medium" ? randomItem(mediumBreeds) :
                  randomItem(largeBreeds);

    const age = randomInt(0, 12);
    const ageCategory = age < 1 ? "puppy" : age <= 3 ? "young" : age <= 7 ? "adult" : "senior";

    const weight = size === "small" ? randomInt(5, 25) :
                   size === "medium" ? randomInt(25, 60) :
                   randomInt(60, 120);

    const energyLevel = randomItem(["low", "moderate", "high", "very_high"]);
    const temperament = randomItem(temperamentOptions);

    const location = randomItem(austinLocations);
    const shelterIndex = i % shelterCount;
    const shelterId = `shelter-user-${shelterIndex + 1}`;
    const shelterName = shelterNames[shelterIndex] || `Shelter ${shelterIndex + 1}`;

    const hasSpecialNeeds = Math.random() > 0.85;
    const specialNeeds = hasSpecialNeeds ? randomItem([
      "Arthritis - needs daily medication",
      "Senior dog - needs soft food",
      "Hearing impaired - uses hand signals",
      "Needs regular exercise due to hip dysplasia",
      "Diabetic - requires insulin",
      "Allergies - special diet required",
      "Vision impaired - familiar environment needed",
      null
    ]) : null;

    const bioTemplates = [
      `Meet ${name}! This ${ageCategory} ${breed.toLowerCase()} is ${energyLevel === "very_high" ? "incredibly energetic and" : energyLevel === "high" ? "very active and" : energyLevel === "moderate" ? "moderately active and" : "calm and"} ${randomItem(["loving", "friendly", "loyal", "playful", "gentle"])}. ${name} would be perfect for ${size === "small" ? "apartment living or a cozy home" : size === "medium" ? "an active household with regular exercise" : "a family with space to run and play"}.`,
      `${name} is a wonderful ${breed} looking for a forever home! ${age < 2 ? "Full of puppy energy" : age > 8 ? "A wise senior" : "An experienced companion"}, ${name} ${randomItem(["loves to cuddle", "enjoys long walks", "is great with families", "is a quick learner"])}.`,
      `This sweet ${breed} named ${name} has been waiting for the right family. ${randomItem(["House-trained and ready to go", "Knows basic commands", "Great on a leash", "Loves car rides"])}, ${name} would thrive in a home that ${randomItem(["appreciates quiet companionship", "enjoys outdoor adventures", "has lots of love to give", "values loyalty"])}.`,
    ];

    // Use a consistent ID for the dog to ensure photos are consistent
    const dogId = `dog-${i}-${name}-${breed}`;

    dogs.push({
      userId: shelterId,
      name,
      breed,
      age,
      ageCategory,
      size,
      weight,
      energyLevel,
      temperament,
      goodWithKids: Math.random() > 0.25,
      goodWithDogs: Math.random() > 0.35,
      goodWithCats: Math.random() > 0.5,
      bio: randomItem(bioTemplates) + (hasSpecialNeeds ? " Please note special needs below." : " Ready for a forever home!"),
      specialNeeds,
      photos: getConsistentPhotos(dogId, 3),
      shelterId,
      shelterName,
      shelterAddress: `${randomInt(100, 9999)} ${randomItem(["Hope", "Compassion", "Rescue", "Love", "Care"])} ${randomItem(["Street", "Avenue", "Boulevard", "Lane", "Drive"])}, Austin, TX ${randomInt(78701, 78799)}`,
      shelterPhone: `(512) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      latitude: location.lat + (Math.random() - 0.5) * 0.03,
      longitude: location.lng + (Math.random() - 0.5) * 0.03,
      vaccinated: Math.random() > 0.05,
      spayedNeutered: Math.random() > 0.15,
    });
  }

  return dogs;
}

// User profile generation with more variety
const firstNames = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason", "Isabella", "William",
  "Mia", "James", "Charlotte", "Benjamin", "Amelia", "Lucas", "Harper", "Henry", "Evelyn", "Alexander",
  "Abigail", "Michael", "Emily", "Daniel", "Elizabeth", "Matthew", "Sofia", "Jackson", "Avery", "Sebastian",
  "Ella", "David", "Scarlett", "Joseph", "Grace", "Carter", "Chloe", "Owen", "Camila", "Wyatt",
  "Penelope", "John", "Riley", "Jack", "Layla", "Luke", "Lillian", "Jayden", "Nora", "Dylan"
];

export function generateFakeUsers(): InsertUserProfile[] {
  const users: InsertUserProfile[] = [];

  // Generate 50 adopter profiles with varied preferences
  for (let i = 0; i < 50; i++) {
    const location = randomItem(austinLocations);

    const homeType = randomItem(["house", "apartment", "condo"]);
    const hasYard = homeType === "house" ? Math.random() > 0.2 : Math.random() > 0.85;
    const hasOtherPets = Math.random() > 0.5;

    const activityLevel = randomItem(["very_active", "active", "moderate", "relaxed"]);
    const workSchedule = randomItem(["home", "hybrid", "office"]);
    const exerciseCommitment = randomItem(["multiple_daily", "daily", "weekly"]);
    const experienceLevel = randomItem(["expert", "some_experience", "first_time"]);

    // More varied preferences
    const sizePreferenceCount = randomInt(1, 3);
    const preferredSize = randomItems(["small", "medium", "large"], sizePreferenceCount);

    const agePreferenceCount = randomInt(1, 3);
    const preferredAge = randomItems(["puppy", "young", "adult", "senior"], agePreferenceCount);

    const energyPreferenceCount = randomInt(1, 3);
    const preferredEnergy = randomItems(["low", "moderate", "high"], energyPreferenceCount);

    users.push({
      homeType,
      hasYard,
      hasOtherPets,
      otherPetsType: hasOtherPets ? randomItem(["dog", "cat", "both", null]) : null,
      activityLevel,
      workSchedule,
      exerciseCommitment,
      experienceLevel,
      preferredSize: Array.from(new Set(preferredSize)),
      preferredAge: Array.from(new Set(preferredAge)),
      preferredEnergy: Array.from(new Set(preferredEnergy)),
      latitude: location.lat + (Math.random() - 0.5) * 0.06,
      longitude: location.lng + (Math.random() - 0.5) * 0.06,
      searchRadius: randomInt(5, 75),
    });
  }

  return users;
}

// Generate fake rehome profiles
export function generateFakeRehomers(): InsertUserProfile[] {
  const rehomers: InsertUserProfile[] = [];
  
  const cities = ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown", "Leander", "Manor", "Buda"];
  const rehomeReasons = [
    "Moving to an apartment that doesn't allow pets",
    "Job relocation overseas",
    "Developed severe allergies",
    "New baby and can't manage both",
    "Landlord policy changed unexpectedly",
    "Moving to assisted living",
    "Divorce situation",
    "Financial hardship",
    "Too much travel for work",
    "Dog needs more space than we can provide"
  ];

  // Generate 20 rehome profiles
  for (let i = 0; i < 20; i++) {
    const location = randomItem(austinLocations);
    const city = randomItem(cities);

    rehomers.push({
      mode: "rehome",
      phoneNumber: `(512) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      reasonForRehoming: randomItem(rehomeReasons),
      city,
      state: "TX",
      latitude: location.lat + (Math.random() - 0.5) * 0.03,
      longitude: location.lng + (Math.random() - 0.5) * 0.03,
      searchRadius: 50,
      // Minimal adopter fields
      homeType: null,
      hasYard: null,
      hasOtherPets: null,
      otherPetsType: null,
      activityLevel: null,
      workSchedule: null,
      exerciseCommitment: null,
      experienceLevel: null,
      preferredSize: [],
      preferredAge: [],
      preferredEnergy: [],
    });
  }

  return rehomers;
}

// Generate fake foster profiles
export function generateFakeFosters(): InsertUserProfile[] {
  const fosters: InsertUserProfile[] = [];
  
  const cities = ["Austin", "Round Rock", "Cedar Park", "Pflugerville", "Georgetown", "Leander", "Manor", "Kyle"];
  const fosterExperiences = [
    "Fostered 5+ dogs over the past 2 years. Experienced with puppies and seniors.",
    "New to fostering but have owned dogs my whole life. Excited to help!",
    "Fostered dogs for local rescue for 3 years. Great with special needs dogs.",
    "Previous volunteer at animal shelter. Can handle behavioral issues.",
    "Retired veterinary technician. Comfortable with medical needs.",
    "Work from home so can provide constant care and attention.",
    "Large fenced yard perfect for active dogs. Experience with large breeds.",
    "Apartment living but walk dogs 3x daily. Best for small/medium dogs.",
  ];

  // Generate 25 foster profiles
  for (let i = 0; i < 25; i++) {
    const location = randomItem(austinLocations);
    const city = randomItem(cities);
    const homeType = randomItem(["house", "apartment", "condo"]);
    const hasYard = homeType === "house" ? Math.random() > 0.2 : Math.random() > 0.85;
    const hasChildren = Math.random() > 0.6;
    const hasOtherPets = Math.random() > 0.5;
    
    const capacity = randomItem([1, 1, 1, 2, 2]); // Most can handle 1, some can do 2
    const currentCount = Math.random() > 0.7 ? 1 : 0; // 30% already fostering one dog

    fosters.push({
      mode: "foster",
      phoneNumber: `(512) ${randomInt(200, 999)}-${randomInt(1000, 9999)}`,
      city,
      state: "TX",
      homeType,
      hasYard,
      hasChildren,
      childrenAges: hasChildren ? randomItems(["infant", "toddler", "child", "teen"], randomInt(1, 2)) : [],
      familySize: randomInt(1, 4),
      hasOtherPets,
      otherPetsType: hasOtherPets ? randomItem(["dogs", "cats", "both"]) : null,
      latitude: location.lat + (Math.random() - 0.5) * 0.03,
      longitude: location.lng + (Math.random() - 0.5) * 0.03,
      searchRadius: randomInt(15, 50),
      
      // Foster-specific fields
      fosterVisible: true,
      fosterTimeCommitment: randomItem(["short_term", "medium_term", "long_term", "flexible"]),
      fosterSizePreference: randomItems(["small", "medium", "large", "any"], randomInt(1, 3)),
      fosterAgePreference: randomItems(["puppy", "young", "adult", "senior"], randomInt(1, 3)),
      fosterEnergyPreference: randomItems(["low", "moderate", "high", "very_high"], randomInt(1, 2)),
      fosterSpecialNeedsWilling: Math.random() > 0.5,
      fosterEmergencyAvailability: randomItem(["same_day", "few_days", "week_notice", "month_notice"]),
      fosterPreviousExperience: randomItem(fosterExperiences),
      fosterCapacity: capacity,
      fosterCurrentCount: currentCount,
      fosterMaxWeight: randomItem([25, 40, 60, 80, 100]),
      
      // Minimal adopter fields
      activityLevel: null,
      workSchedule: null,
      exerciseCommitment: null,
      experienceLevel: null,
      preferredSize: [],
      preferredAge: [],
      preferredEnergy: [],
      reasonForRehoming: null,
    });
  }

  return fosters;
}