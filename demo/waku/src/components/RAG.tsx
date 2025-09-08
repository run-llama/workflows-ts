"use client";
import { createClient } from "@llamaindex/workflow-http/client";
import { useCallback, useState } from "react";
import * as events from "../workflow/events";

const { fetch } = createClient("/api/store", events);

export const RAG = () => {
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
              stream.forEach((event) => {
                console.log(event);
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

      <form
        action={(form) => {
          const search = form.get("search") as string;
          fetch({
            search,
          }).then((stream) => {
            stream.forEach((event) => {
              console.log(event);
              if (event.data) {
                setList((prev) => [...prev, `${event.data}`]);
              }
            });
          });
        }}
      >
        <input
          type="text"
          name="search"
          className="border-gray-400 mt-4 w-full rounded-sm border p-2"
          placeholder="Search something..."
        />
        <button type="submit" />
      </form>

      {list.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div className="text-sm max-h-12 max-w-64 overflow-scroll">
            {item}
          </div>
        </div>
      ))}
    </section>
  );
};
