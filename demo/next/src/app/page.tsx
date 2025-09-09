"use client";

import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Search, BookOpen } from "lucide-react";
import { FileDisplay } from "@/components/custom/file-display";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [outputPath, setOutputPath] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (query.trim() === "") return;

    setError("");
    setIsProcessing(true);
    setOutputPath(null);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.outputPath) {
        setOutputPath(data.outputPath);
      } else {
        setError(data.refusal);
      }
      setQuery("");
    } catch (err) {
      console.error("Search error:", err);
      setError("Failed to retrieve relevant information. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const ques = e.target.value;
    if (ques) {
      setQuery(ques);
    }
  };

  return (
    <div className="max-w min-h-screen mx-auto p-6 space-y-6 bg-gradient-to-br from-purple-300 via-white to-purple-500">
      <div className="text-center space-y-2">
        <h1 className="text-3xl font-bold">Report Generator</h1>
        <p className="text-muted-foreground">
          Search the web for news, get an AI report, download the PDF
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Generate PDF news reports with AI
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="border-2 rounded-lg p-8 text-center transition-colors">
            <div className="space-y-4">
              <Search className="w-12 h-12 mx-auto text-muted-foreground" />
              <div className="space-y-2">
                <Input
                  id="search-docs"
                  value={query}
                  onChange={handleQueryChange}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full space-y-4">
            <Button
              onClick={handleSearch}
              className="w-full bg-gradient-to-br from-purple-300 to-purple-500 hover:from-purple-500 hover:to-purple-300 text-black"
            >
              Generate Report
            </Button>

            {/* Error Display */}
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </div>
        </CardFooter>
      </Card>

      {/* Processing Indicator */}
      {isProcessing && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
              <span>Searching for relevant information...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Output Section */}
      {outputPath && !isProcessing && (
        <>
          <Separator />
          <FileDisplay outputPath={outputPath} />
        </>
      )}
    </div>
  );
}
