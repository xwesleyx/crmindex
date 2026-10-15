"use client";

import { Smile } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EMOJI_CATEGORIES } from "@/features/atendimento/emoji-data";

// Fica aberto depois de escolher um emoji (pedido implícito de qualquer
// picker de chat — dá pra empilhar vários sem reabrir toda vez); só fecha
// no X, Esc ou clique fora (comportamento padrão do Popover).
export function EmojiPicker({ onSelect, disabled }: { onSelect: (emoji: string) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              render={
                <Button type="button" variant="ghost" size="icon-sm" disabled={disabled}>
                  <Smile className="size-4" />
                </Button>
              }
            />
          }
        />
        <TooltipContent>Emoji</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="w-72 p-2">
        <Tabs defaultValue={EMOJI_CATEGORIES[0].label}>
          <TabsList variant="line" className="w-full">
            {EMOJI_CATEGORIES.map((category) => (
              <TabsTrigger key={category.label} value={category.label} className="text-xs">
                {category.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {EMOJI_CATEGORIES.map((category) => (
            <TabsContent key={category.label} value={category.label}>
              <div className="grid grid-cols-8 gap-0.5">
                {category.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className="flex size-8 items-center justify-center rounded-md text-lg hover:bg-muted"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
