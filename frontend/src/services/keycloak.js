import Keycloak from 'keycloak-js';
import { Settings } from '../settings';

export class KeycloakService {

  static login(url, realm, client_id) {
    const keycloakInstance = new Keycloak({url: url, realm: realm, clientId: client_id,
      responseMode: 'query', redirectUri: Settings.serverUrl + '/login/auth/keycloak'});
    keycloakInstance.init({onLoad: 'login-required', checkLoginIframe: false});
  }
}
