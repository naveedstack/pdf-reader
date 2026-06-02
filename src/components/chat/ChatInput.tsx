"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ChatInputProps {
  onSendMessage: (text: string) => void;
  isLoading: boolean;
  isFetchingHistory: boolean;
}

export default function ChatInput({ onSendMessage, isLoading, isFetchingHistory }: ChatInputProps) {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading || isFetchingHistory) return;
    
    onSendMessage(inputText);
    setInputText("");
  };

  return (
    <form onSubmit={handleSubmit} className="relative flex gap-2 p-2 border border-slate-200 rounded-2xl bg-white/80 backdrop-blur-md shadow-lg transition-all focus-within:shadow-xl focus-within:border-primary/30 mx-auto w-full shrink-0">
      <Input
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        placeholder="Ask a question about this document..."
        className="border-none focus-visible:ring-0 bg-transparent text-[15px] px-4 py-6 h-auto placeholder:text-slate-400"
        disabled={isFetchingHistory}
      />
      <Button 
        type="submit" 
        size="icon"
        className="h-auto w-12 rounded-xl shrink-0 transition-transform hover:scale-105 active:scale-95"
        disabled={isLoading || !inputText.trim() || isFetchingHistory}
      >
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5 ml-0.5" />}
      </Button>
    </form>
  );
}
