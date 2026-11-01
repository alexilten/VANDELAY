/**
 * Marks a figure as an example. Every number the prototype shows is
 * illustrative until engines produce real ones, and must say so.
 */
export function ExampleTag({ children = 'Example' }: { children?: string }) {
  return <span className="v-example">{children}</span>;
}
