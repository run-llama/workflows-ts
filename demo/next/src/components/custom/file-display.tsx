"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileText, Eye, ExternalLink } from "lucide-react";

interface FileDisplayProps {
  outputPath: string;
}

export function FileDisplay({ outputPath }: FileDisplayProps) {
  const [isLoading, setIsLoading] = useState(false);

  // Extract filename from path
  const filename = outputPath.split("/").pop() || "report.pdf";
  const fileExtension = filename.split(".").pop()?.toLowerCase();

  const handleDownload = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: outputPath }),
      });
      const blob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleView = () => {
    window.open(
      outputPath.replaceAll("./public", "").replaceAll("public/", ""),
      "_blank",
    );
  };

  const getFileIcon = () => {
    switch (fileExtension) {
      case "pdf":
        return <FileText className="w-8 h-8 text-purple-500" />;
      default:
        return <FileText className="w-8 h-8 text-gray-500" />;
    }
  };

  const getFileType = () => {
    switch (fileExtension) {
      case "pdf":
        return "PDF Document";
      case "txt":
        return "Text File";
      case "docx":
        return "Word Document";
      default:
        return "Document";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getFileIcon()}
          Report Generated Successfully
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
          <div className="flex items-center gap-3">
            {getFileIcon()}
            <div>
              <p className="font-medium">{filename}</p>
              <p className="text-sm text-muted-foreground">{getFileType()}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleView}
              className="flex items-center gap-2 bg-transparent"
            >
              <Eye className="w-4 h-4" />
              View
              <ExternalLink className="w-3 h-3" />
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isLoading}
              className="flex items-center gap-2 bg-gradient-to-br from-purple-300 to-purple-500 hover:from-purple-500 hover:to-purple-300 text-black"
            >
              <Download className="w-4 h-4" />
              {isLoading ? "Downloading..." : "Download"}
            </Button>
          </div>
        </div>

        {/* PDF Preview for PDF files */}
        {fileExtension === "pdf" && (
          <div className="border rounded-lg overflow-hidden">
            <iframe
              src={outputPath
                .replaceAll("./public", "")
                .replaceAll("public/", "")}
              className="w-full h-96"
              title="PDF Preview"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
