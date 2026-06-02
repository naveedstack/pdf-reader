"use client";

import { useState } from "react";
import { User, Bot, Copy, Check, Pencil } from "lucide-react";
import { UIMessage } from "@ai-sdk/react";

interface MessageItemProps {
  message: UIMessage;
  isLoading: boolean;
  onSaveEdit: (messageId: string, newText: string) => void;
}

export default function MessageItem({ message, isLoading, onSaveEdit }: MessageItemProps) {
  const [isCopied, setIsCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingText, setEditingText] = useState("");

  const getMessageText = (m: any) => {
    if (m.parts && Array.isArray(m.parts)) {
      return m.parts.map((p: any) => (p.type === 'text' ? p.text : '')).join('');
    }
    return typeof m.content === 'string' ? m.content : '';
  };

  const messageText = getMessageText(message);
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(messageText);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditingText(messageText);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingText("");
  };

  const handleSaveEdit = () => {
    if (!editingText.trim() || isLoading) return;
    onSaveEdit(message.id, editingText);
    setIsEditing(false);
  };

  return (
    <div className={`group flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${
      isUser ? "justify-end" : "justify-start"
    }`}>
      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] ${isUser ? "flex-row-reverse" : ""}`}>
        <div className={`p-2 rounded-full flex-shrink-0 shadow-sm ${
          isUser ? "bg-primary text-white" : "bg-white border text-primary"
        }`}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </div>
        
        <div className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
          {isEditing ? (
            <div className="bg-primary text-white px-4 py-3 rounded-2xl shadow-sm rounded-br-sm flex flex-col gap-2 min-w-[240px] sm:min-w-[340px]">
              <textarea
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                className="w-full min-h-[70px] p-2.5 text-[15px] bg-white/10 text-white border border-white/25 rounded-xl focus:outline-none focus:ring-2 focus:ring-white/40 resize-y"
                rows={2}
                autoFocus
              />
              <div className="flex justify-end gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white rounded-lg font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="px-3 py-1.5 bg-white text-primary rounded-lg font-semibold hover:bg-white/95 transition-colors shadow-sm disabled:opacity-50"
                  disabled={!editingText.trim() || isLoading}
                >
                  Save & Send
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                isUser 
                  ? "bg-primary text-white rounded-br-sm" 
                  : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
              }`}>
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {message.parts ? (message.parts as any[]).map((part: any, index: number) => 
                    part.type === 'text' ? <span key={index}>{part.text}</span> : null
                  ) : (message as any).content}
                </div>
              </div>

              {/* Hover action bar */}
              <div className={`flex items-center gap-1.5 mt-1 text-slate-400 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200 ${
                isUser ? "justify-end" : "justify-start"
              }`}>
                <button 
                  onClick={handleCopy}
                  className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                  title="Copy message"
                >
                  {isCopied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                {isUser && (
                  <button 
                    onClick={handleStartEdit}
                    className="p-1 hover:text-slate-600 dark:hover:text-slate-300 rounded transition-colors"
                    title="Edit message"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
