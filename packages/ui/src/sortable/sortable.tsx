import React, { Fragment, useEffect } from "react";
import { monitorForElements } from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import { Draggable } from "./draggable";

type Props<T> = {
  data: T[];
  render: (item: T, index: number) => React.ReactNode;
  onChange: (data: T[]) => void;
  keyExtractor: (item: T, index: number) => string;
  containerClassName?: string;
};

const moveItem = <T,>(
  data: T[],
  source: T,
  destination: T & Record<symbol, string>,
  keyExtractor: (item: T, index: number) => string
) => {
  const sourceIndex = data.indexOf(source);
  if (sourceIndex === -1) return data;

  const destinationIndex = data.findIndex((item, index) => keyExtractor(item, index) === keyExtractor(destination, 0));

  if (destinationIndex === -1) return data;

  const symbolKey = Reflect.ownKeys(destination).find((key) => key.toString() === "Symbol(closestEdge)");
  const position = symbolKey ? destination[symbolKey as symbol] : "bottom"; // Add 'as symbol' to cast symbolKey to symbol
  const newData = [...data];
  const [movedItem] = newData.splice(sourceIndex, 1);

  let adjustedDestinationIndex = destinationIndex;
  if (position === "bottom") {
    adjustedDestinationIndex++;
  }

  // Prevent moving item out of bounds
  if (adjustedDestinationIndex > newData.length) {
    adjustedDestinationIndex = newData.length;
  }

  newData.splice(adjustedDestinationIndex, 0, movedItem);

  return newData;
};

export const Sortable = <T,>({ data, render, onChange, keyExtractor, containerClassName }: Props<T>) => {
  useEffect(() => {
    const unsubscribe = monitorForElements({
      onDrop({ source, location }) {
        const destination = location?.current?.dropTargets[0];
        if (!destination) return;
        onChange(moveItem(data, source.data as T, destination.data as T & { closestEdge: string }, keyExtractor));
      },
    });

    // Clean up the subscription on unmount
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [data, onChange]);

  return (
    <>
      {data.map((item, index) => (
        <Draggable key={keyExtractor(item, index)} data={item} className={containerClassName}>
          <Fragment>{render(item, index)} </Fragment>
        </Draggable>
      ))}
    </>
  );
};

export default Sortable;