import { configure } from 'enzyme';
import Adapter from '@wojtekmaj/enzyme-adapter-react-17';

export function setupTests() {
  configure({adapter: new Adapter()});
}
