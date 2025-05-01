// decorator for making Linkify links open in a new tab
// TODO replace with linkify-react, as react-linkify is 6 years old
export const linkifyDecorator = (href, text, key) => (
  <a href={href} key={key} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);
