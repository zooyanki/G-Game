import Phaser from 'phaser';
import { ENEMY_LIVES, SCREEN_HEIGHT, SCREEN_WIDTH, SLASH_MS } from '../constants';
import { Arrow } from '../entities/Arrow';
import { Chest } from '../entities/Chest';
import { Enemy } from '../entities/Enemy';
import { Hero } from '../entities/Hero';
import { input } from '../input/InputState';
import { setRestartVisible } from '../input/touchControls';
import { CAMPAIGN } from '../missions/campaign';
import { MissionRunner } from '../missions/MissionRunner';
import type { MissionProgress } from '../missions/types';
import { purse } from '../purse';
import { createTextures, heroTexture } from '../textures';

type Outcome = 'victory' | 'dead' | null;

type MapGoal = {
  missionId: string;
  kind: string;
  rect: Phaser.Geom.Rectangle;
};

type MapItem = {
  itemId: string;
  sprite: Phaser.Physics.Arcade.Image;
};

/**
 * Открытый мир: тайлмап из Tiled, party, бой и цепочка миссий.
 */
export class WorldScene extends Phaser.Scene {
  private swordsman!: Hero;
  private archer!: Hero;
  private lives = 0;
  private active!: Hero;
  private enemies: Enemy[] = [];
  private arrows: Arrow[] = [];
  private goals: MapGoal[] = [];
  private items: MapItem[] = [];
  private chests: Chest[] = [];
  private missions!: MissionRunner;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  private shiftKey!: Phaser.Input.Keyboard.Key;
  private banner!: Phaser.GameObjects.Text;
  private missionLabel!: Phaser.GameObjects.Text;
  private interactHint!: Phaser.GameObjects.Text;
  private lootPanel: Phaser.GameObjects.Container | null = null;
  private marker!: Phaser.GameObjects.Image;
  private hearts: Phaser.GameObjects.Image[] = [];
  private coinLabel!: Phaser.GameObjects.Text;
  private portraits: Phaser.GameObjects.GameObject[] = [];
  private outcome: Outcome = null;

  constructor() {
    super('world');
  }

  preload() {
    this.load.image('tiles', 'map/tileset.png');
    this.load.tilemapTiledJSON('world', 'map/world.tmj');
  }

  create() {
    input.clearTransient();
    setRestartVisible(false);
    this.outcome = null;
    this.enemies = [];
    this.arrows = [];
    this.goals = [];
    this.items = [];
    this.chests = [];
    this.hearts = [];
    this.portraits = [];
    this.lootPanel = null;

    createTextures(this);

    const map = this.make.tilemap({ key: 'world' });
    const tiles = map.addTilesetImage('world', 'tiles');
    if (!tiles) throw new Error('Тайлсет world не загрузился');

    const ground = map.createLayer('ground', tiles, 0, 0);
    const collision = map.createLayer('collision', tiles, 0, 0);
    if (!ground || !collision) throw new Error('Слои ground/collision не найдены');

    ground.setDepth(0);
    collision.setDepth(1);
    collision.setVisible(false);
    collision.setCollisionByExclusion([-1]);

    const worldW = map.widthInPixels;
    const worldH = map.heightInPixels;
    this.physics.world.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setBackgroundColor('#c2a36b');

    const spawn = this.readSpawn(map);
    this.swordsman = new Hero(this, spawn.x, spawn.y, 'sword');
    this.archer = new Hero(this, spawn.x, spawn.y, 'bow');
    this.lives = this.swordsman.lives;
    this.active = this.swordsman;
    this.archer.setVisible(false);
    (this.archer.body as Phaser.Physics.Arcade.Body).setEnable(false);

    this.spawnFromObjects(map);
    this.physics.add.collider(this.party(), collision);
    this.physics.add.collider(this.enemies, collision);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.overlap(this.party(), this.enemies, (_hero, enemy) => {
      this.onHeroTouched(_hero as Hero, enemy as Enemy);
    });

    this.missions = new MissionRunner(CAMPAIGN, (progress) => this.onMissionProgress(progress));
    this.events.on('enemy-killed', (missionId: string | undefined) => {
      this.missions.onEnemyKilled(missionId);
    });

    this.marker = this.add.image(0, 0, 'marker').setDepth(12).setVisible(false);
    this.cameras.main.startFollow(this.active, true, 1, 1, 0, 50);

    this.createHud();
    this.bindKeyboard();
    this.drawHearts();
    this.drawPortraits();
    this.refreshMarker();

    this.events.once('shutdown', this.shutdown, this);
  }

  /** Сцена на restart переиспользуется — слушатели и стрелы надо снять явно. */
  shutdown() {
    this.events.off('enemy-killed');
    for (const arrow of this.arrows) {
      if (arrow.active) arrow.kill();
    }
    this.arrows = [];
    this.enemies = [];
    this.goals = [];
    this.items = [];
    this.chests = [];
    this.hearts = [];
    this.portraits = [];
    this.lootPanel = null;
  }

  update() {
    const now = this.time.now;
    this.active.tick(now);

    if (this.outcome === 'dead') {
      this.freeze();
      return;
    }

    if (this.outcome === 'victory') {
      this.freeze();
      const restart = Phaser.Input.Keyboard.JustDown(this.attackKey) || input.consumeRestart();
      if (restart) {
        purse.coins = 0;
        this.scene.restart();
      }
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.shiftKey) || input.consumeSwap()) this.swapHero();

    this.active.move(this.readMoveX(), this.readMoveY());

    const nearChest = this.chests.find((chest) => !chest.isOpen && chest.inReach(this.active.getBounds()));
    this.interactHint.setVisible(!!nearChest);

    const interact = Phaser.Input.Keyboard.JustDown(this.attackKey) || input.hasAttack();
    if (nearChest && interact) {
      this.openChest(nearChest);
      input.clearAttack();
    } else {
      const wantsAttack = this.attackKey.isDown || input.hasAttack();
      if (wantsAttack) {
        const shot = this.active.tryAttack(now);
        if (shot instanceof Phaser.Geom.Rectangle) this.swing(shot);
        else if (shot) this.arrows.push(shot);
        if (shot) input.clearAttack();
      }
    }

    this.hitArrows();
    this.collectCoins();
    this.checkGoalsAndItems();
    this.refreshMarker();
    for (const enemy of this.enemies) enemy.chase(this.active.x, this.active.y);
  }

  private readSpawn(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer('objects');
    const spawn = layer?.objects.find((obj) => obj.type === 'spawn' || obj.name === 'start');
    if (!spawn) return { x: map.widthInPixels / 2, y: map.heightInPixels - 80 };
    return {
      x: (spawn.x ?? 0) + (spawn.width ?? 0) / 2,
      y: (spawn.y ?? 0) + (spawn.height ?? 0) / 2,
    };
  }

  private spawnFromObjects(map: Phaser.Tilemaps.Tilemap) {
    const layer = map.getObjectLayer('objects');
    if (!layer) return;

    for (const obj of layer.objects) {
      const props = propsOf(obj);
      const cx = (obj.x ?? 0) + (obj.width ?? 0) / 2;
      const cy = (obj.y ?? 0) + (obj.height ?? 0) / 2;

      if (obj.type === 'enemy') {
        this.enemies.push(new Enemy(this, cx, cy, props.missionId));
        continue;
      }

      if (obj.type === 'goal' && props.missionId) {
        this.goals.push({
          missionId: props.missionId,
          kind: props.kind ?? 'reach',
          rect: new Phaser.Geom.Rectangle(obj.x ?? 0, obj.y ?? 0, obj.width || 16, obj.height || 16),
        });
        continue;
      }

      if (obj.type === 'item' && props.itemId) {
        const sprite = this.physics.add.staticImage(cx, cy, 'amulet');
        sprite.setDepth(6);
        sprite.setData('itemId', props.itemId);
        this.items.push({ itemId: props.itemId, sprite });
        continue;
      }

      if (obj.type === 'chest') {
        this.chests.push(new Chest(this, cx, cy));
      }
    }
  }

  private openChest(chest: Chest) {
    const coins = chest.tryOpen();
    if (coins == null) return;
    purse.coins += coins;
    this.coinLabel.setText(String(purse.coins));
    this.showLoot(coins);
  }

  /** Окно с содержимым: сколько монет выпало из сундука. */
  private showLoot(coins: number) {
    this.lootPanel?.destroy(true);
    const onPhone = window.matchMedia('(pointer: coarse)').matches;

    const panel = this.add.container(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.42);
    panel.setScrollFactor(0).setDepth(110);

    const bg = this.add.rectangle(0, 0, 120, 52, 0x111111, 0.92);
    const title = this.add
      .text(0, -14, 'Сундук', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f4f0e6',
      })
      .setOrigin(0.5);
    const row = this.add.container(0, 6);
    const startX = -((coins - 1) * 10) / 2;
    for (let i = 0; i < coins; i += 1) {
      row.add(this.add.image(startX + i * 10, 0, 'coin'));
    }
    const label = this.add
      .text(0, 20, `+${coins}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#f2d48a',
      })
      .setOrigin(0.5);

    panel.add([bg, title, row, label]);
    this.lootPanel = panel;

    this.time.delayedCall(onPhone ? 1800 : 1600, () => {
      if (this.lootPanel === panel) {
        panel.destroy(true);
        this.lootPanel = null;
      }
    });
  }

  private checkGoalsAndItems() {
    const mission = this.missions.current;
    if (!mission) return;

    const hero = this.active.getBounds();

    for (const item of this.items) {
      if (!item.sprite.active) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(hero, item.sprite.getBounds())) continue;
      item.sprite.destroy();
      this.missions.onItemPicked(item.itemId);
      this.events.emit('item-picked', item.itemId);
    }

    for (const goal of this.goals) {
      if (goal.missionId !== mission.id) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(hero, goal.rect)) continue;
      this.missions.onReachGoal(goal.missionId);
    }
  }

  private onMissionProgress(progress: MissionProgress | null) {
    if (this.missionLabel) {
      this.missionLabel.setText(this.missions.hudText());
    }
    this.refreshMarker();

    if (!progress && this.missions.isComplete) this.onVictory();
  }

  private refreshMarker() {
    if (!this.marker) return;
    const mission = this.missions.current;
    if (!mission) {
      this.marker.setVisible(false);
      return;
    }

    if (mission.kind === 'fetch' && !this.missions.carryingItem && mission.itemId) {
      const item = this.items.find((entry) => entry.itemId === mission.itemId && entry.sprite.active);
      if (item) {
        this.marker.setPosition(item.sprite.x, item.sprite.y - 10);
        this.marker.setVisible(true);
        return;
      }
    }

    const goal = this.goals.find((entry) => entry.missionId === mission.id);
    if (goal) {
      this.marker.setPosition(goal.rect.centerX, goal.rect.centerY);
      this.marker.setVisible(true);
      return;
    }

    if (mission.kind === 'kill') {
      const target = this.enemies.find((enemy) => enemy.active && enemy.missionId === mission.id);
      if (target) {
        this.marker.setPosition(target.x, target.y - 12);
        this.marker.setVisible(true);
        return;
      }
    }

    this.marker.setVisible(false);
  }

  private readMoveX() {
    let x = 0;
    if (this.cursors.left.isDown) x -= 1;
    if (this.cursors.right.isDown) x += 1;
    if (input.moveX !== 0 || input.moveY !== 0) x = input.moveX;
    return x;
  }

  private readMoveY() {
    let y = 0;
    if (this.cursors.up.isDown) y -= 1;
    if (this.cursors.down.isDown) y += 1;
    if (input.moveX !== 0 || input.moveY !== 0) y = input.moveY;
    return y;
  }

  private hitArrows() {
    this.arrows = this.arrows.filter((arrow) => {
      if (!arrow.active) return false;

      const from = new Phaser.Geom.Line(arrow.prevX, arrow.prevY, arrow.x, arrow.y);
      const hit = this.enemies.find((enemy) => enemy.active && Phaser.Geom.Intersects.LineToRectangle(from, enemy.getBounds()));
      if (!hit) return true;

      hit.hurt(1);
      arrow.kill();
      return false;
    });
  }

  private collectCoins() {
    const hero = this.active.getBounds();
    for (const coin of this.children.list) {
      if (!(coin instanceof Phaser.GameObjects.Image) || !coin.getData('coin')) continue;
      if (!Phaser.Geom.Intersects.RectangleToRectangle(hero, coin.getBounds())) continue;
      coin.destroy();
      purse.coins += 1;
      this.coinLabel.setText(String(purse.coins));
    }
  }

  private swing(slash: Phaser.Geom.Rectangle) {
    const mark = this.add.rectangle(slash.centerX, slash.centerY, slash.width, slash.height, 0xf4f0e6);
    mark.setDepth(11);
    this.time.delayedCall(SLASH_MS, () => mark.destroy());

    for (const enemy of this.enemies) {
      if (!enemy.active) continue;
      if (Phaser.Geom.Intersects.RectangleToRectangle(slash, enemy.getBounds())) enemy.hurt(ENEMY_LIVES);
    }
  }

  private onHeroTouched(hero: Hero, enemy: Enemy) {
    if (this.outcome || !enemy.active) return;
    if (!hero.hurt(this.time.now)) return;

    this.lives -= 1;
    this.drawHearts();
    this.cameras.main.flash(120, 160, 40, 40);
    if (this.lives > 0) return;

    this.outcome = 'dead';
    this.freeze();
    // Перезапуск вне шага физики: restart из overlap иногда подвешивает Arcade.
    this.time.delayedCall(400, () => {
      if (!this.sys.isActive()) return;
      purse.coins = 0;
      this.scene.restart();
    });
  }

  private onVictory() {
    this.outcome = 'victory';
    this.freeze();
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    this.banner.setText(onPhone ? 'Победа' : 'Победа\nПробел — ещё раз');
    this.banner.setVisible(true);
    setRestartVisible(true);
  }

  private party() {
    return [this.swordsman, this.archer];
  }

  private swapHero() {
    const next = this.active === this.swordsman ? this.archer : this.swordsman;
    next.setPosition(this.active.x, this.active.y);
    next.facing = this.active.facing;
    next.setTexture(heroTexture(next.kind, next.facing));

    this.active.halt();
    this.active.setVisible(false);
    (this.active.body as Phaser.Physics.Arcade.Body).setEnable(false);

    next.setVisible(true);
    (next.body as Phaser.Physics.Arcade.Body).setEnable(true);
    this.active = next;
    this.drawPortraits();
    this.cameras.main.startFollow(this.active, true, 1, 1, 0, 50);
  }

  private freeze() {
    this.active.halt();
    for (const enemy of this.enemies) enemy.setVelocity(0, 0);
  }

  private createHud() {
    const onPhone = window.matchMedia('(pointer: coarse)').matches;
    if (!onPhone) {
      this.add
        .text(8, 58, 'Стрелки — идти, пробел — удар/открыть, Shift — герой', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#f4f0e6',
        })
        .setScrollFactor(0)
        .setDepth(100)
        .setResolution(1);
    }

    this.missionLabel = this.add
      .text(8, 46, this.missions.hudText(), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#f2d48a',
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);

    this.interactHint = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT - 18, onPhone ? 'Удар — открыть сундук' : 'Пробел — открыть сундук', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#f4f0e6',
        backgroundColor: '#111111',
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1)
      .setVisible(false);

    this.coinLabel = this.add
      .text(SCREEN_WIDTH - 8, 8, String(purse.coins), {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#f2d48a',
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1);

    this.banner = this.add
      .text(SCREEN_WIDTH / 2, SCREEN_HEIGHT * 0.36, '', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#f4f0e6',
        align: 'center',
        backgroundColor: '#111111',
        padding: { x: 8, y: 6 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(1)
      .setVisible(false);
  }

  private drawPortraits() {
    for (const portrait of this.portraits) portrait.destroy();
    this.portraits = [];

    for (const [index, hero] of this.party().entries()) {
      const chosen = hero === this.active;
      const x = 12 + index * 20;

      if (chosen) {
        const frame = this.add.rectangle(x, 30, 18, 18, 0xf4f0e6);
        frame.setScrollFactor(0).setDepth(99);
        this.portraits.push(frame);
      }

      const portrait = this.add.image(x, 30, heroTexture(hero.kind, 'down'));
      portrait.setScrollFactor(0).setDepth(100);
      portrait.setAlpha(chosen ? 1 : 0.4);
      this.portraits.push(portrait);
    }
  }

  private drawHearts() {
    for (const heart of this.hearts) heart.destroy();
    this.hearts = [];
    for (let i = 0; i < this.lives; i += 1) {
      const heart = this.add.image(12 + i * 12, 12, 'heart');
      heart.setScrollFactor(0).setDepth(100);
      this.hearts.push(heart);
    }
  }

  private bindKeyboard() {
    const keyboard = this.input.keyboard;
    if (!keyboard) throw new Error('Клавиатура недоступна');
    this.cursors = keyboard.createCursorKeys();
    this.attackKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    keyboard.addCapture([
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ]);
  }
}

function propsOf(obj: Phaser.Types.Tilemaps.TiledObject) {
  const result: Record<string, string> = {};
  const props = obj.properties as unknown;
  if (Array.isArray(props)) {
    for (const prop of props) {
      if (prop && typeof prop === 'object' && 'name' in prop && 'value' in prop) {
        result[String((prop as { name: string }).name)] = String((prop as { value: unknown }).value);
      }
    }
  } else if (props && typeof props === 'object') {
    for (const [key, value] of Object.entries(props as Record<string, unknown>)) {
      result[key] = String(value);
    }
  }
  return result as { missionId?: string; kind?: string; itemId?: string };
}
