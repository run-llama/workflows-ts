"use client";
import { createClient } from "@llama-flow/http/client";
import * as events from "../workflow/events";

import { useEffect, useState } from "react";

const { fetch } = createClient("/api/workflow", events);

export const Counter = () => {
  const [list, setList] = useState<any[]>([]);

  useEffect(() => {
    fetch("").then((stream) => {
      stream.on(events.stopEvent, () => {
        console.log("stop!");
      });
      stream.forEach((event) => {
        if (event.data) {
          setList((prev) => [...prev, `${event.data}`]);
        }
      });
    });
  }, []);

  return (
    <section className="border-blue-400 -mx-4 mt-4 rounded-sm border border-dashed p-4">
      {list.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <span className="text-sm text-gray-400">{item.data}</span>
        </div>
      ))}
    </section>
  );
};
