#!/usr/bin/env python3
"""Send queued alerts only after committed state. No Telegram secret stored in repo."""
import json
import os
from pathlib import Path
import requests

ROOT = Path(__file__).resolve().parent

def main():
    payload = json.loads((ROOT / 'pending_alerts.json').read_text(encoding='utf-8'))
    token = os.getenv('TELEGRAM_BOT_TOKEN', '')
    chat_id = os.getenv('TELEGRAM_CHAT_ID', '')
    alerts = payload.get('alerts', [])
    if not alerts:
        print('Aucun changement : aucune notification')
        return
    if not token or not chat_id:
        print('Telegram non configuré : changements conservés dans le tableau de bord')
        return
    for item in alerts:
        msg = ('VeilleRadar — changement détecté\n'
               + str(item['name'])[:100] + '\n' + str(item['url'])[:450] + '\n'
               + 'Avant : ' + str(item.get('before', ''))[:180] + '\n'
               + 'Après : ' + str(item.get('after', ''))[:180])
        res = requests.post('https://api.telegram.org/bot' + token + '/sendMessage',
                            json={'chat_id': chat_id, 'text': msg[:3800], 'disable_web_page_preview': True},
                            timeout=12)
        res.raise_for_status()
    print(f'{len(alerts)} notifications Telegram transmises')

if __name__ == '__main__':
    main()
