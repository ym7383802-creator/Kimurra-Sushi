"use client";

import * as React from "react";
import { ShoppingBag } from "lucide-react";
import SushiConveyorMenu from "@/components/ui/sushi-conveyor-menu";
import type { ConveyorDish } from "@/components/ui/sushi-conveyor-menu";

export const KIMURA_BELT_ITEMS: ConveyorDish[] = [
  {
    id: "noodles-chicken",
    name: "Chicken Noodles – نودلز فراخ",
    price: "150 EGP",
    tier: 1,
    description: "نودلز مع قطع الفراخ، خضار سوتيه، صويا صوص، ترياكي وسمسم.",
    details: ["KIMURA NOODLES", "Original · Spicy · Extra Spicy"],
    image: "/src/assets/images/cat_noodles_1795001031049.jpg",
  },
  {
    id: "raw-green-dragon",
    name: "Green Dragon – جرين دراجون",
    price: "35 EGP",
    tier: 2,
    description: "جمبري تمبورا، كريم تشيز، وتوبينج أفوكادو وصوص أوناجي.",
    details: ["Raw Special Rolls", "1 pc"],
    image: "/src/assets/images/sushi_dragon_roll_1795000107444.jpg",
  },
  {
    id: "raw-salmon-lava",
    name: "Salmon Lava Roll – سالمون لافا",
    price: "40 EGP",
    tier: 3,
    description: "سالمون، أفوكادو، كريم تشيز، وتوبينج سالمون مع سبايسي مايو.",
    details: ["Raw Special Rolls", "1 pc"],
    image: "/src/assets/images/raw_salmon_lava_1795699866308.jpg",
  },
  {
    id: "fried-kimura-special",
    name: "Kimura Special – كيمورا سبيشيال",
    price: "35 EGP",
    tier: 2,
    description: "جمبري، كراب، كريم تشيز، وتوبينج كراب مع صوص كيمورا الخاص.",
    details: ["Fried Special Rolls", "1 pc"],
    image: "/src/assets/images/fried_kimura_special_1795699867236.jpg",
  },
  {
    id: "noodles-shrimp",
    name: "Shrimp Noodles – نودلز جمبري",
    price: "200 EGP",
    tier: 4,
    description: "نودلز مع الجمبري، خضار سوتيه، صوص آسيوي وسمسم.",
    details: ["KIMURA NOODLES", "Original · Spicy · Extra Spicy"],
    image: "/src/assets/images/noodles_shrimp_1795699865212.jpg",
  },
  {
    id: "raw-rainbow-roll",
    name: "Rainbow Roll – رينبو رول",
    price: "45 EGP",
    tier: 5,
    description: "كراب، خيار، أفوكادو، وتوبينج سالمون وتونة وجمبري مطهي.",
    details: ["Raw Special Rolls", "1 pc"],
    image: "/src/assets/images/raw_rainbow_roll_1795699866486.jpg",
  },
  {
    id: "fried-cheese-bomb",
    name: "Cheese Bomb – تشيز بومب",
    price: "30 EGP",
    tier: 1,
    description: "جمبري، موتزاريلا، كريم تشيز، وصوص شيدر.",
    details: ["Fried Special Rolls", "1 pc"],
    image: "/src/assets/images/fried_cheese_bomb_1795699867791.jpg",
  },
  {
    id: "raw-crab-volcano",
    name: "Crab Volcano – كراب فولكانو",
    price: "30 EGP",
    tier: 1,
    description: "جمبري، خيار، وتوبينج ميكس كراب وسبايسي مايو.",
    details: ["Raw Special Rolls", "1 pc"],
    image: "/src/assets/images/raw_crab_volcano_1795699866596.jpg",
  },
];

export default function SushiConveyorMenuDemo({ autoplay = true }: { autoplay?: boolean }) {
  const [count, setCount] = React.useState(0);
  const [flash, setFlash] = React.useState(false);
  const timer = React.useRef(0);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  const add = () => {
    setCount((n) => n + 1);
    setFlash(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFlash(false), 2400);
  };

  return (
    <div data-sushi-demo className="relative flex min-h-svh w-full items-center justify-center bg-background text-foreground">
      <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
        <span
          aria-live="polite"
          className={`rounded-full bg-foreground px-2.5 py-1 text-[11px] font-medium text-background transition-[opacity,translate] duration-300 motion-reduce:transition-none ${
            flash ? "translate-x-0 opacity-100" : "translate-x-1 opacity-0"
          }`}
        >
          {flash ? "Added" : ""}
        </span>
        <button
          type="button"
          data-order-count
          aria-label={`Your order: ${count} ${count === 1 ? "plate" : "plates"}`}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-card-foreground shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ShoppingBag aria-hidden="true" className="size-4" />
          <span data-order-total className="font-mono tabular-nums">
            {count}
          </span>
        </button>
      </div>
      <SushiConveyorMenu
        items={KIMURA_BELT_ITEMS}
        eyebrow="Kimura Sushi · Official Menu"
        heading="Raw rolls, fried rolls, noodles & combo boxes."
        caption="Hover to pause a plate, flick to spin the belt, or pick a dish to order."
        autoplay={autoplay}
        onAdd={add}
        action={
          <a
            href="#menu"
            className="inline-flex items-center rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background shadow-sm outline-none transition-[translate,box-shadow] hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none"
          >
            Browse all categories
          </a>
        }
      />
    </div>
  );
}
