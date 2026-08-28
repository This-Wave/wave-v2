/**
 * The four dev accounts, copied from packages/db/scripts/seed-auth.ts.
 * The UUIDs are pinned there and are the same ids Neon's Profile rows carry.
 */
export const ACCOUNTS = {
  admin: { id: "f9aa5728-6af6-4d0b-9609-a079e1eea924", phone: "+233271234567", password: "WaveAdmin123!", name: "Wave Platform Admin" },
  student: { id: "6a2f924d-256d-4599-a239-6b71ce9a7e25", phone: "+233241234567", password: "WaveDev123!", name: "Ama Owusu" },
  rider: { id: "4e45b6f3-0da4-446b-a547-2cf8138028e0", phone: "+233551234567", password: "WaveRider123!", name: "Kofi Boateng" },
  shop: { id: "54b6d4ba-bbdf-4d1b-a17a-6aeecea01633", phone: "+233201234567", password: "WaveShop123!", name: "Mama Put Kitchen (Owner)" },
} as const;

export type RoleKey = keyof typeof ACCOUNTS;
