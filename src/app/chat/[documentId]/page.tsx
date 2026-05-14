"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, AlertCircle } from "lucide-react";

// TODO: Ensure this path matches exactly where you initialize Firebase in your project!
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/config";

export default function ChatPage() {
  const { documentId } = useParams();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [inputText, setInputText] = useState("");
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);

  // 1. Create the transport to handle the API route and the Body payload (Vercel v5 syntax)
  const transport = useMemo(() => new DefaultChatTransport({
    api: "/api/chat",
    prepareSendMessagesRequest: ({ messages }) => {
      return {
        body: {
          messages, // Crucial for Vercel v5
          documentId: documentId,
          workspaceId: user?.uid,
        },
      };
    },
  }), [documentId, user?.uid]);

  // 2. Initialize useChat with the transport and grab the new `sendMessage` function
  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: documentId as string,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // --- 3. FETCH CHAT HISTORY ON LOAD ---
  useEffect(() => {
    const loadHistory = async () => {
      if (!documentId) return;
      try {
        const docRef = doc(db, "chats", documentId as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().messages) {
          setMessages(docSnap.data().messages);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsFetchingHistory(false);
      }
    };

    loadHistory();
  }, [documentId, setMessages]);

  // --- 4. SAVE CHAT HISTORY AFTER STREAMING FINISHES ---
  useEffect(() => {
    const saveHistory = async () => {
      // Only save if we have messages, we aren't currently streaming, and we've finished the initial load
      if (messages.length > 0 && status !== "streaming" && status !== "submitted" && !isFetchingHistory) {
        try {
          const docRef = doc(db, "chats", documentId as string);
          await setDoc(docRef, {
            messages: messages,
            workspaceId: user?.uid || null, // <-- Fix: Fallback to null instead of undefined
            updatedAt: new Date().toISOString()
          }, { merge: true }); // Merge ensures we don't overwrite other document data
        } catch (err) {
          console.error("Failed to save chat history:", err);
        }
      }
    };

    saveHistory();
  }, [messages, status, isFetchingHistory, documentId, user?.uid]);

  // --- 5. AUTO-SCROLL TO BOTTOM ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, error]);

  // --- 6. HANDLE USER SUBMIT ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isLoading) return;
    
    // The new v5 way to send a message
    sendMessage({ text: inputText });
    setInputText("");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] max-w-4xl mx-auto p-4">
      <ScrollArea className="flex-1 pr-4 mb-4 border rounded-lg bg-slate-50/50 p-4" ref={scrollRef}>
        
        {/* Loading History State */}
        {isFetchingHistory ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p>Loading your conversation...</p>
          </div>
        ) : messages.length === 0 && !error ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
            <Bot className="h-12 w-12" />
            <p>The document is ready. Ask me anything about it!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-start gap-3 max-w-[80%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-full flex-shrink-0 ${m.role === "user" ? "bg-primary text-white" : "bg-white border"}`}>
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`p-3 rounded-2xl shadow-sm ${m.role === "user" ? "bg-primary text-white" : "bg-white border"}`}>
                    <div className="text-sm whitespace-pre-wrap">
                      {m.parts ? m.parts.map((part, index) => 
                        part.type === 'text' ? <span key={index}>{part.text}</span> : null
                      ) : (m as any).content}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Error Message UI */}
            {error && (
              <div className="flex justify-center my-4">
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl flex items-center gap-3 text-sm max-w-[80%] shadow-sm">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p>
                    {error.message.includes("429") 
                      ? "Google API Quota Exceeded. Please wait a minute before sending another message."
                      : error.message}
                  </p>
                </div>
              </div>
            )}

            {/* Thinking / Streaming Indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && !error && (
               <div className="flex justify-start">
                 <div className="bg-white border p-3 rounded-2xl shadow-sm flex items-center gap-2">
                   <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                   <span className="text-sm text-slate-400">Thinking...</span>
                 </div>
               </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="flex gap-2 p-2 border rounded-xl bg-white shadow-lg">
        <Input
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Ask a question about this document..."
          className="border-none focus-visible:ring-0"
          disabled={isFetchingHistory}
        />
        <Button type="submit" disabled={isLoading || !inputText.trim() || isFetchingHistory}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}