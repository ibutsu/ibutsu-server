import { configure } from 'enzyme';
import Adapter from 'enzyme-adapter-react-16';

export function setupTests() {
  configure({adapter: new Adapter()});
}
