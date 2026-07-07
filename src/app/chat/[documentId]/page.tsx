"use client";

import { useRef, useEffect, useMemo, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Bot, Loader2, AlertCircle } from "lucide-react";
import MessageItem from "@/components/chat/MessageItem";
import ChatInput from "@/components/chat/ChatInput";

// TODO: Ensure this path matches exactly where you initialize Firebase in your project!
import { db } from "@/lib/firebase/config"; 
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function ChatPage() {
  const { documentId } = useParams();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [briefingData, setBriefingData] = useState<{
    summary: string;
    takeaways: string[];
    suggestedQuestions: string[];
  } | null>(null);

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
      if (!documentId || !user) return;
      try {
        const docRef = doc(db, "chats", documentId as string);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists() && docSnap.data().messages && docSnap.data().messages.length > 0) {
          setMessages(docSnap.data().messages);
        } else {
          // Load document briefing if no history exists
          setIsBriefingLoading(true);
          const response = await fetch("/api/documents/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId,
              workspaceId: user.uid,
            }),
          });
          if (response.ok) {
            const data = await response.json();
            setBriefingData(data);
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsFetchingHistory(false);
        setIsBriefingLoading(false);
      }
    };

    loadHistory();
  }, [documentId, user, setMessages]);

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

  // --- 6. SEND MESSAGE HANDLER ---
  const handleSendMessage = (text: string) => {
    sendMessage({ text });
  };

  // --- 7. EDIT MESSAGE HANDLER ---
  const handleSaveEdit = async (messageId: string, newText: string) => {
    // Truncate messages state at the edited message and remove it and all subsequent messages
    const messageIndex = messages.findIndex((m) => m.id === messageId);
    if (messageIndex !== -1) {
      const truncatedMessages = messages.slice(0, messageIndex);
      setMessages(truncatedMessages);
    }

    // Resend the message
    sendMessage({ text: newText });
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
          <div className="flex-1 flex flex-col justify-center max-w-2xl mx-auto w-full py-4 md:py-8 space-y-6 animate-in fade-in duration-500">
            {isBriefingLoading ? (
              // Loading Briefing Skeleton
              <div className="space-y-6 animate-pulse">
                <div className="flex items-center gap-3 mb-2">
                  <div className="h-10 w-10 bg-slate-200 rounded-full" />
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-slate-200 rounded w-1/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </div>
                </div>
                
                <div className="bg-slate-100/50 border border-slate-200/40 p-5 rounded-2xl space-y-3">
                  <div className="h-3 bg-slate-200 rounded w-full" />
                  <div className="h-3 bg-slate-200 rounded w-5/6" />
                  <div className="h-3 bg-slate-200 rounded w-2/3" />
                </div>

                <div className="space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-200 rounded w-4/5" />
                    <div className="h-3 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-4/5" />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="h-4 bg-slate-200 rounded w-1/4" />
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="h-11 bg-slate-200 rounded-xl" />
                    <div className="h-11 bg-slate-200 rounded-xl" />
                    <div className="h-11 bg-slate-200 rounded-xl" />
                  </div>
                </div>
              </div>
            ) : briefingData ? (
              // AI Briefing Board
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-full text-primary">
                    <Bot className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">Document Briefing</h2>
                    <p className="text-xs text-slate-500">AI-generated summary and takeaways</p>
                  </div>
                </div>

                {/* Summary Card */}
                <div className="bg-gradient-to-br from-blue-50/50 to-indigo-50/20 border border-blue-100/60 p-5 rounded-2xl shadow-sm relative overflow-hidden">
                  <div className="absolute right-0 top-0 w-24 h-24 bg-blue-100/30 rounded-full blur-xl -z-10" />
                  <h3 className="text-sm font-semibold text-blue-800 mb-2">Summary</h3>
                  <p className="text-[15px] leading-relaxed text-slate-700 font-medium">
                    {briefingData.summary}
                  </p>
                </div>

                {/* Key Takeaways */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Key Takeaways</h3>
                  <ul className="space-y-2.5">
                    {briefingData.takeaways.map((takeaway, idx) => (
                      <li key={idx} className="flex items-start gap-3 bg-white border border-slate-100 p-3.5 rounded-xl shadow-sm">
                        <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="text-[14.5px] leading-snug text-slate-700">{takeaway}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Suggested Questions */}
                <div className="space-y-3 pt-2">
                  <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Suggested Questions</h3>
                  <div className="grid grid-cols-1 gap-2.5">
                    {briefingData.suggestedQuestions.map((question, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSendMessage(question)}
                        className="text-left px-4 py-3.5 text-[14px] font-medium text-slate-700 bg-white hover:bg-primary/5 border border-slate-200/80 hover:border-primary/30 rounded-xl transition-all duration-200 shadow-sm hover:shadow flex items-center justify-between group"
                      >
                        <span>{question}</span>
                        <svg className="h-4 w-4 text-slate-400 group-hover:text-primary group-hover:translate-x-0.5 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Default Fallback UI (if API fails or returns null)
              <div className="flex flex-col items-center justify-center text-slate-400 space-y-4 py-10">
                <div className="bg-primary/10 p-6 rounded-full shadow-inner mb-2">
                  <Bot className="h-14 w-14 text-primary animate-bounce" />
                </div>
                <h3 className="text-xl font-semibold text-slate-700">Document is Ready</h3>
                <p className="text-center max-w-sm text-slate-500">I've analyzed the document. You can ask me anything about its contents, request summaries, or extract key points!</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 pb-2">
            {messages.map((m) => (
              <MessageItem
                key={m.id}
                message={m}
                isLoading={isLoading}
                onSaveEdit={handleSaveEdit}
              />
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
      <ChatInput
        onSendMessage={handleSendMessage}
        isLoading={isLoading}
        isFetchingHistory={isFetchingHistory}
      />
    </div>
  );
}