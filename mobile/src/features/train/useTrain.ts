import { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { blankData, TrainData } from "./domain";
export function useTrain(uid: string) {
  const [data, setData] = useState<TrainData>(blankData),
    [ready, setReady] = useState(false),
    [error, setError] = useState("");
  const owner = useRef(uid);
  owner.current = uid;
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    let live = true;
    setReady(false);
    setData(blankData());
    setError("");
    void AsyncStorage.getItem("fitkin:train:v1:" + uid)
      .then((raw) => {
        if (!live) return;
        const d = raw ? JSON.parse(raw) : blankData();
        if (
          !Array.isArray(d.plans) ||
          !Array.isArray(d.history) ||
          !Array.isArray(d.favorites)
        )
          throw Error(
            "Saved workout data could not be read. Export or recover device storage before resetting.",
          );
        setData(d);
        setReady(true);
      })
      .catch((e) => {
        if (live) setError(e.message || "Could not load workouts.");
      });
    return () => {
      live = false;
    };
  }, [uid]);
  const update = useCallback(
    (fn: (s: TrainData) => TrainData) => {
      const id = uid;
      if (!ready || owner.current !== id) return;
      setData((previous) => {
        const next = fn(previous),
          value = JSON.stringify(next);
        queue.current = queue.current
          .catch(() => {})
          .then(() => AsyncStorage.setItem("fitkin:train:v1:" + id, value))
          .catch(() => {
            if (owner.current === id)
              setError(
                "Device storage is full or unavailable. Export your workouts before closing.",
              );
          });
        return next;
      });
    },
    [uid, ready],
  );
  return { data, ready, error, update };
}
