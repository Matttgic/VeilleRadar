# VeilleRadar — MVP fonctionnel

**But :** suivre les changements de pages publiques (prix, stocks, annonces, offres d'emploi) avec un tableau de bord lisible sur mobile et des alertes Telegram. Projet indépendant de Revue.

### Ce qui est réellement opérationnel
- Vérification de jusqu'à 20 pages, par défaut toutes les heures via GitHub Actions.
- Surveillance de la page entière ou d'un élément CSS (`selector`).
- Première observation sans fausse alerte ; changements détectés par empreinte SHA-256 du texte normalisé.
- Historique des 50 derniers changements ; erreurs et contrôles visibles sur la page GitHub Pages.
- Notifications Telegram facultatives. Aucun token dans le code.
- Blocage des IP privées, de `localhost`, des ports exotiques et des redirections évidentes vers ces adresses ; taille maximale 1 Mo.
- Tests indépendants des sites externes.

### Mise en service (depuis un smartphone)
1. Créez un dépôt public GitHub **VeilleRadar** sous votre compte, avec `main` comme branche par défaut, puis ajoutez-y les fichiers de ce dossier.
2. Dans `config/monitors.json`, ajoutez par exemple :

```json
{
  "monitors": [
    {
      "id": "mon-prix",
      "name": "Prix du produit",
      "url": "https://www.exemple.fr/produit",
      "selector": ".product-price"
    }
  ]
}
```

3. Dans **Settings → Pages**, choisissez **GitHub Actions** comme source.
4. Dans **Actions → VeilleRadar - Surveillance et publication**, lancez **Run workflow** une fois. La première vérification établit la référence sans alerte.
5. Pour Telegram, créez un bot avec BotFather, renseignez `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID` dans **Settings → Secrets and variables → Actions**. Ne publiez jamais ces valeurs dans GitHub ou le chat.
6. Après publication : `https://<votre-compte>.github.io/VeilleRadar/`.

### Développement local

```bash
python -m pip install -r requirements.txt
python -m unittest discover -s tests -v
python monitor.py
python -m http.server 8000 --directory docs
```

Ouvrir `http://localhost:8000`.

### Limites à connaître

- **MVP propriétaire de dépôt, pas SaaS :** pas encore de comptes clients, paiements, onboarding autonome, tableau de bord privé ou gestion de permissions. Un hébergement back-end et une vraie base de données seront nécessaires pour une commercialisation multi-utilisateurs.
- **GitHub Actions n'offre pas une exécution à la minute garantie.** Les horaires peuvent être retardés ; le cron d'une heure est indicatif.
- **Les données du tableau de bord et les historiques sont publics** quand le dépôt l'est. Ne surveillez pas de pages privées ou contenant des données confidentielles dans cette version.
- Le contrôle des URL limite les destinations dangereuses mais ne remplace pas un proxy réseau isolé ; n'exposez pas le scanner en tant que service librement configurable par des clients sans protections réseau supplémentaires contre les redirections/DNS rebinding.
- Les pages rendues entièrement en JavaScript et les interfaces derrière captcha/authentification ne sont pas couvertes. Pas de contournement d'accès. Respectez les robots.txt, les conditions d'utilisation et évitez les requêtes excessives.
- Les changements de structure ou les éléments dynamiques peuvent produire des alertes non pertinentes : utilisez un sélecteur CSS précis.
- Les notifications Telegram sont envoyées **après** le commit des résultats ; en cas d'erreur de transmission, elles ne sont pas relancées automatiquement.

### Déploiement business ensuite
Tester cette version avec 5–10 utilisateurs et une niche (prix chez les petits commerçants, offres d'emploi ou annonces ciblées). Quand le besoin est confirmé : authentification, backend isolé, stockage privé, worker dédié, paiements et limites par offre, tests de sécurité SSRF et conformité RGPD.
