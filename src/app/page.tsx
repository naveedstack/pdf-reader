"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";

import { ArrowRight, FileText, MessageSquare, ShieldCheck } from "lucide-react";

export default function LandingPage() {
  const { user } = useAuth();

  return (
    <div className="flex flex-col min-h-screen bg-white">
      {/* Hero Section */}
      <main className="flex-1">
        <section className="py-20 px-6 text-center max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-slate-900 mb-6">
            Talk to your documents with <span className="text-primary">Precision.</span>
          </h1>
          <p className="text-xl text-slate-600 mb-10 leading-relaxed">
            Upload your PDFs and get instant, context-aware answers. Built for engineers and teams who need enterprise-grade RAG performance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="text-md px-8 py-6 h-auto" asChild>
              <Link href={user ? "/documents" : "/signup"}>
                Start Building Now <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-6 grid md:grid-cols-3 gap-12">
            <FeatureCard 
              icon={<FileText className="h-10 w-10 text-primary" />}
              title="Smart Ingestion"
              description="Upload large PDFs. We handle the chunking and embedding automatically."
            />
            <FeatureCard 
              icon={<MessageSquare className="h-10 w-10 text-primary" />}
              title="Contextual Chat"
              description="Our RAG pipeline ensures answers are strictly grounded in your data."
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-10 w-10 text-primary" />}
              title="Enterprise Secure"
              description="Your data is isolated and protected with Firebase and Pinecone namespaces."
            />
          </div>
        </section>
      </main>

      <footer className="py-10 border-t text-center text-slate-500 text-sm">
        © 2026 DocuMind AI. Built by Naveed Ul Rehman.
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border hover:shadow-md transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </div>
  );
}