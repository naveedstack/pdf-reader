"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Bot, User, Loader2, AlertCircle } from "lucide-react";

// TODO: Ensure this path matches exactly where you initialize Firebase in your project!
import { db } from "@/lib/firebase/config"; 
import { doc, getDoc, setDoc } from "firebase/firestore";

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
          
          // Deep clean the messages array to strip ALL undefined values so Firebase doesn't crash
          const sanitizedMessages = JSON.parse(JSON.stringify(messages));

          await setDoc(docRef, {
            messages: sanitizedMessages,
            workspaceId: user?.uid || null, // Fallback to null instead of undefined
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
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
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
    <div className="flex flex-col h-[calc(100dvh-80px)] w-full max-w-4xl mx-auto p-4 md:p-6 bg-slate-50/30">
      <div className="flex-1 overflow-y-auto scroll-smooth custom-scrollbar mb-4 bg-white border shadow-sm rounded-2xl p-4 md:p-6 flex flex-col relative">
        
        {/* Loading History State */}
        {isFetchingHistory ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in duration-500">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="font-medium text-slate-500">Loading your conversation...</p>
          </div>
        ) : messages.length === 0 && !error ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 space-y-4 animate-in fade-in zoom-in-95 duration-500">
            <div className="bg-primary/10 p-6 rounded-full shadow-inner mb-2">
              <Bot className="h-14 w-14 text-primary animate-bounce" />
            </div>
            <h3 className="text-xl font-semibold text-slate-700">Document is Ready</h3>
            <p className="text-center max-w-sm text-slate-500">I've analyzed the document. You can ask me anything about its contents, request summaries, or extract key points!</p>
          </div>
        ) : (
          <div className="space-y-6 pb-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`p-2 rounded-full flex-shrink-0 shadow-sm ${m.role === "user" ? "bg-primary text-white" : "bg-white border text-primary"}`}>
                    {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                  </div>
                  <div className={`px-4 py-3 rounded-2xl shadow-sm ${
                    m.role === "user" 
                      ? "bg-primary text-white rounded-br-sm" 
                      : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                  }`}>
                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
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
              <div className="flex justify-center my-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-xl flex items-center gap-3 text-sm max-w-[85%] shadow-sm">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-500" />
                  <p className="font-medium">
                    {error.message.includes("429") 
                      ? "Google API Quota Exceeded. Please wait a minute before sending another message."
                      : error.message}
                  </p>
                </div>
              </div>
            )}

            {/* Thinking / Streaming Indicator */}
            {isLoading && messages[messages.length - 1]?.role === "user" && !error && (
               <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2">
                 <div className="flex items-end gap-2">
                   <div className="p-2 rounded-full bg-white border text-primary shadow-sm flex-shrink-0">
                     <Bot className="h-4 w-4" />
                   </div>
                   <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-3">
                     <Loader2 className="h-4 w-4 animate-spin text-primary" />
                     <span className="text-sm font-medium text-slate-500">Thinking...</span>
                   </div>
                 </div>
               </div>
            )}
            
            {/* Invisible div for reliable auto-scrolling */}
            <div ref={scrollRef} className="h-px" />
          </div>
        )}
      </div>

      {/* Floating Input Form */}
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
    </div>
  );
}