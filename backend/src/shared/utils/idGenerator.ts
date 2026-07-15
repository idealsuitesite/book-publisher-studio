export function createIdGenerator(namespace: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${namespace}-${counter}`;
  };
}