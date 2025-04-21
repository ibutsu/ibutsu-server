// decorator for making Linkify links open in a new tab
export const linkifyDecorator = (href, text, key) => (
  <a href={href} key={key} target="_blank" rel="noopener noreferrer">
    {text}
  </a>
);
