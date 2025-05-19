"use client";
import { createClient } from "@llama-flow/http/client";
import * as events from "../workflow/events";
import { useState, useCallback } from "react";

const { fetch } = createClient("/api/workflow", events);

export const Counter = () => {
  const [list, setList] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        const selectedFiles = Array.from(e.target.files);
        setFile(selectedFiles[0]!);
      }
    },
    [],
  );

  return (
    <section className="border-blue-400 -mx-4 mt-4 rounded-sm border p-4">
      <div>
        <input type="file" onChange={handleFileInput} id="file-upload" />
        <button
          onClick={async () => {
            fetch({
              file,
            }).then((stream) => {
              stream.on(events.stopEvent, () => {
                console.log("stop!");
              });
              stream.forEach((event) => {
                if (event.data) {
                  setList((prev) => [...prev, `${event.data}`]);
                }
              });
            });
          }}
        >
          Run
        </button>
      </div>

      {list.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{item.data}</span>
        </div>
      ))}
    </section>
  );
};
