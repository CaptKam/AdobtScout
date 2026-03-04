import { db } from "../db";
import { dogs } from "@shared/schema";
import { eq } from "drizzle-orm";

const breedPhotos: Record<string, string[]> = {
  "Labrador Retriever": [
    "/attached_assets/generated_images/yellow_labrador_retriever_portrait.png",
    "/attached_assets/generated_images/chocolate_lab_relaxed_outdoors.png",
    "/attached_assets/generated_images/black_lab_puppy_portrait.png",
    "/attached_assets/generated_images/senior_yellow_lab_portrait.png",
    "/attached_assets/generated_images/lab_running_action_shot.png",
    "/attached_assets/generated_images/senior_lab_wise_portrait.png",
    "/attached_assets/generated_images/black_lab_athletic_portrait.png",
    "/attached_assets/generated_images/lab_happy_smile_joyful_portrait.png",
  ],
  "Australian Shepherd": [
    "/attached_assets/generated_images/australian_shepherd_blue_eyes.png",
    "/attached_assets/generated_images/red_australian_shepherd_meadow.png",
    "/attached_assets/generated_images/aussie_puppy_portrait.png",
    "/attached_assets/generated_images/aussie_merle_focused_portrait.png",
    "/attached_assets/generated_images/aussie_puppy_floppy_ears_portrait.png",
    "/attached_assets/generated_images/aussie_copper_points_intelligent_portrait.png",
    "/attached_assets/generated_images/blue_merle_border_collie_portrait.png",
  ],
  "Golden Retriever": [
    "/attached_assets/generated_images/golden_retriever_classic_portrait.png",
    "/attached_assets/generated_images/golden_retriever_playing.png",
    "/attached_assets/generated_images/senior_golden_retriever_portrait.png",
    "/attached_assets/generated_images/young_golden_playful_portrait.png",
    "/attached_assets/generated_images/golden_retriever_puppy_innocent_portrait.png",
    "/attached_assets/generated_images/golden_tennis_ball_playful_portrait.png",
    "/attached_assets/generated_images/senior_golden_grey_face_loving_portrait.png",
  ],
  "Maltese": [
    "/attached_assets/generated_images/white_maltese_elegant_portrait.png",
    "/attached_assets/generated_images/maltese_puppy_fluffy_portrait.png",
    "/attached_assets/generated_images/senior_maltese_gentle_portrait.png",
    "/attached_assets/generated_images/maltese_mix_fluffy_portrait.png",
    "/attached_assets/generated_images/maltese_topknot_elegant_portrait.png",
    "/attached_assets/generated_images/maltese_puppy_cut_everyday_portrait.png",
  ],
  "French Bulldog": [
    "/attached_assets/generated_images/cream_french_bulldog_portrait.png",
    "/attached_assets/generated_images/brindle_frenchie_head_tilt.png",
    "/attached_assets/generated_images/fawn_frenchie_puppy_portrait.png",
    "/attached_assets/generated_images/piebald_frenchie_quirky_portrait.png",
    "/attached_assets/generated_images/frenchie_sleeping_derpy_portrait.png",
    "/attached_assets/generated_images/frenchie_grass_adventure_portrait.png",
    "/attached_assets/generated_images/black_frenchie_elegant_portrait.png",
  ],
  "German Shepherd": [
    "/attached_assets/generated_images/german_shepherd_noble_portrait.png",
    "/attached_assets/generated_images/german_shepherd_puppy_ears.png",
    "/attached_assets/generated_images/german_shepherd_relaxed_outdoors.png",
    "/attached_assets/generated_images/senior_german_shepherd_wise_portrait.png",
    "/attached_assets/generated_images/german_shepherd_protective_portrait.png",
  ],
  "Shepherd Mix": [
    "/attached_assets/generated_images/shepherd_mix_handsome_portrait.png",
    "/attached_assets/generated_images/senior_shepherd_mix_loyal_portrait.png",
    "/attached_assets/generated_images/shepherd_mix_puppy_ears_portrait.png",
  ],
  "Pembroke Welsh Corgi": [
    "/attached_assets/generated_images/corgi_happy_meadow_portrait.png",
    "/attached_assets/generated_images/corgi_puppy_sitting_portrait.png",
    "/attached_assets/generated_images/tricolor_corgi_alert_portrait.png",
    "/attached_assets/generated_images/corgi_running_action_portrait.png",
    "/attached_assets/generated_images/corgi_big_smile_sunny_portrait.png",
    "/attached_assets/generated_images/senior_corgi_wise_happy_portrait.png",
  ],
  "Pomeranian": [
    "/attached_assets/generated_images/orange_pomeranian_fluffy_portrait.png",
    "/attached_assets/generated_images/white_pomeranian_elegant_portrait.png",
    "/attached_assets/generated_images/cream_pomeranian_fluffy_portrait.png",
    "/attached_assets/generated_images/pomeranian_teddy_bear_cut_portrait.png",
    "/attached_assets/generated_images/sable_pomeranian_luxurious_portrait.png",
    "/attached_assets/generated_images/tiny_pomeranian_puppy_fluffy_portrait.png",
  ],
  "Bulldog": [
    "/attached_assets/generated_images/english_bulldog_dignified_portrait.png",
    "/attached_assets/generated_images/bulldog_puppy_wrinkles_portrait.png",
    "/attached_assets/generated_images/bulldog_relaxed_lounging_portrait.png",
    "/attached_assets/generated_images/bulldog_puppy_sleepy_portrait.png",
    "/attached_assets/generated_images/senior_bulldog_distinguished_portrait.png",
  ],
  "Rottweiler": [
    "/attached_assets/generated_images/rottweiler_powerful_portrait.png",
    "/attached_assets/generated_images/rottweiler_puppy_cute_portrait.png",
    "/attached_assets/generated_images/rottweiler_friendly_smile_portrait.png",
    "/attached_assets/generated_images/rottweiler_goofy_tongue_portrait.png",
    "/attached_assets/generated_images/young_rottweiler_playful_portrait.png",
  ],
  "Chihuahua": [
    "/attached_assets/generated_images/chihuahua_big_ears_portrait.png",
    "/attached_assets/generated_images/long-haired_chihuahua_portrait.png",
    "/attached_assets/generated_images/chihuahua_sweater_sassy_portrait.png",
    "/attached_assets/generated_images/tan_chihuahua_confident_portrait.png",
  ],
  "Beagle": [
    "/attached_assets/generated_images/tricolor_beagle_soulful_portrait.png",
    "/attached_assets/generated_images/beagle_puppy_curious_portrait.png",
    "/attached_assets/generated_images/beagle_howling_characteristic_portrait.png",
    "/attached_assets/generated_images/beagle_adventure_wind_portrait.png",
    "/attached_assets/generated_images/senior_beagle_wise_portrait.png",
    "/attached_assets/generated_images/lemon_beagle_light_coloring_portrait.png",
  ],
  "Boxer": [
    "/attached_assets/generated_images/boxer_athletic_brindle_portrait.png",
    "/attached_assets/generated_images/fawn_boxer_playful_portrait.png",
    "/attached_assets/generated_images/boxer_puppy_paws_portrait.png",
    "/attached_assets/generated_images/boxer_white_chest_athletic_portrait.png",
    "/attached_assets/generated_images/white_boxer_unique_playful_portrait.png",
  ],
  "Cocker Spaniel": [
    "/attached_assets/generated_images/golden_cocker_spaniel_portrait.png",
    "/attached_assets/generated_images/black_cocker_spaniel_portrait.png",
    "/attached_assets/generated_images/chocolate_cocker_spaniel_portrait.png",
    "/attached_assets/generated_images/cocker_spaniel_puppy_sweet_portrait.png",
    "/attached_assets/generated_images/buff_cocker_spaniel_elegant_portrait.png",
  ],
  "Siberian Husky": [
    "/attached_assets/generated_images/siberian_husky_blue_eyes_snow.png",
    "/attached_assets/generated_images/husky_heterochromia_eyes_portrait.png",
    "/attached_assets/generated_images/husky_puppy_curious_portrait.png",
    "/attached_assets/generated_images/husky_snow_majestic_portrait.png",
    "/attached_assets/generated_images/husky_amber_eyes_striking_portrait.png",
  ],
  "Doberman Pinscher": [
    "/attached_assets/generated_images/doberman_noble_stance_portrait.png",
    "/attached_assets/generated_images/red_doberman_elegant_portrait.png",
    "/attached_assets/generated_images/doberman_sleek_athletic_portrait.png",
    "/attached_assets/generated_images/doberman_puppy_uncropped_portrait.png",
    "/attached_assets/generated_images/doberman_floppy_ears_friendly_portrait.png",
  ],
  "Terrier Mix": [
    "/attached_assets/generated_images/scruffy_terrier_mix_portrait.png",
    "/attached_assets/generated_images/terrier_mix_puppy_portrait.png",
    "/attached_assets/generated_images/brown_terrier_mix_alert_portrait.png",
    "/attached_assets/generated_images/senior_terrier_mix_portrait.png",
  ],
  "Boston Terrier": [
    "/attached_assets/generated_images/boston_terrier_tuxedo_portrait.png",
    "/attached_assets/generated_images/boston_terrier_puppy_portrait.png",
    "/attached_assets/generated_images/boston_terrier_running_portrait.png",
    "/attached_assets/generated_images/boston_terrier_blue_eyes_portrait.png",
  ],
  "Miniature Schnauzer": [
    "/attached_assets/generated_images/mini_schnauzer_distinguished_portrait.png",
    "/attached_assets/generated_images/black_mini_schnauzer_portrait.png",
    "/attached_assets/generated_images/schnauzer_gentleman_beard_portrait.png",
    "/attached_assets/generated_images/schnauzer_puppy_fuzzy_beard_portrait.png",
    "/attached_assets/generated_images/mini_schnauzer_uncropped_friendly_portrait.png",
  ],
  "Mixed Breed": [
    "/attached_assets/generated_images/mixed_breed_rescue_portrait.png",
    "/attached_assets/generated_images/medium_mixed_breed_happy_portrait.png",
    "/attached_assets/generated_images/mixed_breed_puppy_rescue_portrait.png",
    "/attached_assets/generated_images/spotted_mixed_breed_friendly_portrait.png",
  ],
  "Jack Russell Terrier": [
    "/attached_assets/generated_images/jack_russell_alert_portrait.png",
    "/attached_assets/generated_images/jack_russell_ball_action_portrait.png",
    "/attached_assets/generated_images/jack_russell_standing_action_portrait.png",
  ],
  "Labrador Mix": [
    "/attached_assets/generated_images/yellow_lab_mix_gentle_portrait.png",
    "/attached_assets/generated_images/brindle_lab_mix_rescue_portrait.png",
    "/attached_assets/generated_images/lab_mix_puppy_floppy_portrait.png",
  ],
  "Poodle": [
    "/attached_assets/generated_images/standard_poodle_elegant_portrait.png",
    "/attached_assets/generated_images/apricot_poodle_teddy_portrait.png",
    "/attached_assets/generated_images/red_poodle_curly_elegant_portrait.png",
    "/attached_assets/generated_images/poodle_puppy_teddy_portrait.png",
  ],
  "Border Collie": [
    "/attached_assets/generated_images/border_collie_intense_gaze_portrait.png",
    "/attached_assets/generated_images/blue_merle_border_collie_portrait.png",
    "/attached_assets/generated_images/border_collie_focused_action_portrait.png",
    "/attached_assets/generated_images/border_collie_heterochromia_portrait.png",
  ],
  "Dachshund": [
    "/attached_assets/generated_images/red_dachshund_sweet_portrait.png",
    "/attached_assets/generated_images/black_tan_dachshund_portrait.png",
    "/attached_assets/generated_images/mini_dachshund_puppy_portrait.png",
    "/attached_assets/generated_images/senior_dachshund_wise_portrait.png",
  ],
  "Great Dane": [
    "/attached_assets/generated_images/great_dane_majestic_portrait.png",
    "/attached_assets/generated_images/harlequin_great_dane_portrait.png",
    "/attached_assets/generated_images/great_dane_puppy_paws_portrait.png",
    "/attached_assets/generated_images/great_dane_regal_cropped_portrait.png",
  ],
  "Shih Tzu": [
    "/attached_assets/generated_images/fluffy_shih_tzu_sweet_portrait.png",
    "/attached_assets/generated_images/shih_tzu_puppy_teddy_portrait.png",
    "/attached_assets/generated_images/shih_tzu_running_flowing_portrait.png",
  ],
  "Pit Bull Mix": [
    "/attached_assets/generated_images/pit_bull_gentle_smile_portrait.png",
    "/attached_assets/generated_images/blue_pit_bull_soulful_portrait.png",
    "/attached_assets/generated_images/pit_bull_flower_crown_portrait.png",
  ],
  "Yorkshire Terrier": [
    "/attached_assets/generated_images/yorkshire_terrier_elegant_portrait.png",
    "/attached_assets/generated_images/yorkie_puppy_tiny_portrait.png",
  ],
  "Corgi Mix": [
    "/attached_assets/generated_images/corgi_mix_happy_portrait.png",
    "/attached_assets/generated_images/corgi_running_action_portrait.png",
  ],
  "Chihuahua Mix": [
    "/attached_assets/generated_images/chihuahua_mix_unique_portrait.png",
    "/attached_assets/generated_images/tan_chihuahua_confident_portrait.png",
  ],
  "golden": [
    "/attached_assets/generated_images/golden_retriever_classic_portrait.png",
    "/attached_assets/generated_images/golden_retriever_playing.png",
  ],
  "Siberian Husky Mix": [
    "/attached_assets/generated_images/husky_mix_wolf-like_portrait.png",
    "/attached_assets/generated_images/husky_amber_eyes_striking_portrait.png",
  ],
};

const defaultPhotos = [
  "/attached_assets/generated_images/mixed_breed_rescue_portrait.png",
  "/attached_assets/generated_images/medium_mixed_breed_happy_portrait.png",
  "/attached_assets/generated_images/mixed_breed_puppy_rescue_portrait.png",
];

async function updateDogPhotos() {
  console.log("Starting dog photo update...");

  const allDogs = await db.select().from(dogs);
  console.log(`Found ${allDogs.length} dogs to update`);

  const breedCounters: Record<string, number> = {};
  let updatedCount = 0;

  for (const dog of allDogs) {
    const breed = dog.breed || "Mixed Breed";
    const photos = breedPhotos[breed] || defaultPhotos;

    if (!breedCounters[breed]) {
      breedCounters[breed] = 0;
    }

    const photoIndex = breedCounters[breed] % photos.length;
    const selectedPhoto = photos[photoIndex];
    breedCounters[breed]++;

    await db
      .update(dogs)
      .set({ photos: [selectedPhoto] })
      .where(eq(dogs.id, dog.id));

    updatedCount++;
    console.log(`Updated ${dog.name} (${breed}) with ${selectedPhoto}`);
  }

  console.log(`\nSuccessfully updated ${updatedCount} dogs with unique photos!`);
}

updateDogPhotos()
  .then(() => {
    console.log("Photo update complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error updating photos:", error);
    process.exit(1);
  });
