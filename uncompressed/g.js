class Game {
    constructor(){
        this.init();
    }
    
    init() {
        kontra.init();
        
        let imgs = ["b1", "b2", "g", "e", "w", "l", "i", "q"];
        imgs.forEach(im => {
            kontra.assets.images[im] = document.getElementById(im); 
        });
        
        this.main();
    }

    main() {
        let STATE_INTRO = 0, STATE_PLAY = 1, STATE_CLICK = 2;
        let STOP_FRAME = 23, INVISIBLE_FRAME = 24, DEATH_END_FRAME = 25;
        let DOUBLE_PRESS_LIMIT = .8, FAST_ADVANCE_PX = 8, LOW_HIT = 20, HIGH_HIT = 15;
        let M = Math, RND = M.random, CW = 160, CH = 144, ctx = kontra.context;
        let gameState = STATE_CLICK, socket;
        let DEBUG_GUARD_ACTIVE = true;
        
        let bindSocket = function() {
            socket.on("match", () => {
                if (gameState != STATE_INTRO) return;
                gameState = STATE_PLAY;
            });

            socket.on("mov", (ev, pos) => {
                if (gameState != STATE_PLAY) return;
                enemy.x = pos;
                enemy.goesTo = ev;
            });

            socket.on("dmg", (q) => {
                if (gameState != STATE_PLAY) return;
                heroLife.percent -= q;
                playSound(hitSnd);
            });

            socket.on("end", () => {
                gameState = STATE_INTRO;
            });

            socket.on("disconnect", () => {
                gameState = STATE_INTRO;
            });

            socket.on("error", () => {
                gameState = STATE_INTRO;
            });
        };
        
        kontra.canvas.addEventListener("click", function() {
            if (gameState == STATE_CLICK) {
                gameState = STATE_INTRO;
                socket = io({ upgrade: false, transports: ["websocket"] });
                bindSocket();
            }
        }.bind(this));
        
        //-------------------------- AUDIO ------------------------
        let playSound = function(params) {
            try {
                var soundURL = jsfxr(params);
                var player = new Audio();
                player.addEventListener('error', function(e) {
                    console.log("Error: " + player.error.code);
                }, false);
                player.src = soundURL;
                player.play();
            } catch(e) {}
        }
        
        let hitSnd = [3,,0.38,,0.2212,0.5172,,-0.5812,,,,,,,,,,,1,,,0.2404,,0.5];
        let slashSnd1 = [3,0.1822,0.3,0.055,0.44,0.83,,-0.0799,-0.013,,,,,,-0.1661,,0.3762,-0.5237,0.8838,0.2939,,0.0684,,0.33];
        let slashSnd2 = [3,0.28,0.27,0.055,0.22,0.35,,-0.0799,-0.013,,,,,,-0.1661,,0.3762,-0.5237,0.71,0.8999,,0.0684,,0.32];
        let blockSnd = [2,,0.21,0.697,0.4208,0.6121,,0.0439,0.0484,,,-0.0533,0.9143,0.8145,-0.0385,0.0019,-0.2199,0.86,0.8623,0.2122,0.0316,,-0.5227,0.57];
        let deathSnd = [3,,0.6875,0.5194,0.6151,0.6789,,0.0063,0.3624,0.0015,-0.0428,0.8318,0.7676,0.2346,-0.4347,0.2729,-0.0128,0.0657,0.9999,-0.1319,,0.051,-0.6832,0.57];
        let victorySnd = [0,0.5898,0.71,0.0001,0.8124,0.59,,-0.02,-0.02,,0.93,-0.6417,,,0.2593,0.1546,0.5485,-0.0023,1,-0.26,0.91,0.83,0.58,0.57];
        let fastSlideSnd = [3,0.36,0.89,0.61,0.95,0.54,,0.52,0.0036,,0.9771,0.453,0.4408,,-0.0252,0.6625,0.0891,0.0016,0.4128,-0.5699,0.6257,0.0698,0.0001,0.57];

        //-------------------------- AUDIO ------------------------
        
        let NinjaSprite = function(cfg) {
            cfg.keyRightTimer = 0;
            cfg.keyLeftTimer = 0;
            cfg.lastkeyLeftTimer = 0;
            cfg.lastkeyRightTimer = 0;
            cfg.lastKeyTimer = 0;
            cfg.isMoving = false;
            cfg.isRetreating = false;
            cfg.isStanding = true;
            cfg.dontStandAnymore = false;
            cfg.additionalAnimMovement = 0;
            cfg.finalAdditionalMovement = 0;
            cfg.additionalSprFrame = 0;
            cfg.additionalSprName = "",
            cfg.additionalSprIsSword = false;
            cfg.additionalSprPosition = {x: 0, y: 0};
            cfg.lastMove = "";
            
            kontra.sprite.prototype.init.call(this, cfg);
        };
        NinjaSprite.prototype = Object.create(kontra.sprite.prototype);
        
        let renderFlipped = function() {
            let ctx = kontra.context;
            if (this.flip) {
                ctx.save();
                ctx.translate(CW, 0);
                ctx.scale(-1, 1);
            }
            
            this.draw();
            
            if (this.flip) {
                ctx.restore();
            }
            
            this.advance();
        };
        
        NinjaSprite.prototype.render = renderFlipped;
        
        NinjaSprite.prototype.update = function(dt) {
            this.realX = this.flip ? CW - this.x : this.x;
            
            this.keyRightTimer += dt;
            this.keyLeftTimer += dt;
            this.lastKeyTimer += dt;

            let isPressedLeft = kontra.keys.pressed(this.keys.a) || (this.flip && this.goesTo == "L");
            let isPressedRight = kontra.keys.pressed(this.keys.d) || (this.flip && this.goesTo == "R");
            let isPressedAtkLow = kontra.keys.pressed(this.keys.w) || (this.flip && this.goesTo == "S");
            let isPressedAtkHigh = kontra.keys.pressed(this.keys.s) || (this.flip && this.goesTo == "W");
            
            // GUARD statement to avoid doing anything
            if (this.isMoving) {
                let fr = this._ca.frames;
                let hasStoppedAnim = fr[fr.length-1] == STOP_FRAME;

                // do we need to render additional sprites?
                if (this.additionalSprName.length && this._ca._f == this.additionalSprFrame) {
                    let spr = this.additionalSprIsSword ? sword : (this.flip ? slashFlip : slash);
                    if (this.additionalSprIsSword) spr.flip = this.flip;
                    spr.position.x = this.x + this.additionalSprPosition.x;
                    spr.position.y = this.y + this.additionalSprPosition.y;
                    spr.playAnimation(this.additionalSprName);
                    let hitDamage = this.additionalSprName == "atkH" ? HIGH_HIT : LOW_HIT;
                    this.additionalSprFrame = 0;
                    this.additionalSprName = "";
                    this.additionalSprIsSword = false;
                    
                    // CHECK COLLISION
                    if (spr == slash && isEnemyHit()) {
                        if (DEBUG_GUARD_ACTIVE && enemy.isRetreating || DEBUG_GUARD_ACTIVE && enemy.isStanding) {
                            enemy.isMoving = true;
                            enemy.playAnimation("block");
                            enemy.additionalAnimMovement= -.6;
                            playSound(blockSnd);
                        } else {
                            enemy.isMoving = true;
                            enemy.playAnimation("hit");
                            enemy.additionalAnimMovement= -1;
                            enemyLife.percent -= hitDamage;
                            socket.emit("dmg", hitDamage);
                            playSound(hitSnd);
                        }
                    }
                    if (spr == slashFlip && isHeroHit()) {
                        if (DEBUG_GUARD_ACTIVE && hero.isRetreating || DEBUG_GUARD_ACTIVE && hero.isStanding) {
                            hero.isMoving = true;
                            hero.playAnimation("block");
                            hero.additionalAnimMovement= -.6;
                            playSound(blockSnd);
                        } else {
                            hero.isMoving = true;
                            hero.playAnimation("hit");
                            hero.additionalAnimMovement = -1;
//                            heroLife.percent -= hitDamage;
                        }
                    }
                } 

                // lets see if hero has finished attacking / advancing
                if (this._ca._f == fr.length-1) {
                    if (hasStoppedAnim || this.dontStandAnymore) {
                        this.x += this.finalAdditionalMovement;
                        this.additionalAnimMovement = 0;
                        this.finalAdditionalMovement = 0;
                        this.x = this.x | 0;
                        if (!this.flip) socket.emit("mov", "", this.x);
                        this.isMoving = false;
                    }
                } else {
                    this.x += this.additionalAnimMovement;
                    // GUARD return if not
                    return;
                }
            }
            
            // CHECK DEATH
            if (heroLife.isDead || enemyLife.isDead) {
                heroLife.isDead = enemyLife.isDead = false;
                
                let ninjaWhoDied = heroLife.percent <= 0 ? hero : enemy;
                let ninjaWhoWon = heroLife.percent <= 0 ? enemy : hero;
                
                // death animation
                ninjaWhoDied.isMoving = true;
                ninjaWhoDied.playAnimation("death");
                ninjaWhoDied.additionalSprName = "death";
                ninjaWhoDied.additionalSprFrame = 0;
                ninjaWhoDied.additionalSprPosition = {x: 24, y:15};
                ninjaWhoDied.additionalSprIsSword = true;
                ninjaWhoDied.additionalAnimMovement = 0;
                ninjaWhoDied.finalAdditionalMovement = -6;
                ninjaWhoDied.dontStandAnymore = true;

                bgEnding.enabled = true;

                playSound(deathSnd);
                setTimeout(function() {
                    swordFly.x = ninjaWhoDied.x + 24;
                    swordFly.y = ninjaWhoDied.y + 15;
                    swordFly.playAnimation("fly");
                    swordFly.flip = ninjaWhoDied.flip;
                    swordFly.enabled = true;
                }.bind(this), 750);
                
                setTimeout(function() {
                    bgEnding.enabled = false;
                    playSound(victorySnd);
                }.bind(this), 1500);
                
                // victory animation
                setTimeout(function() {
                    ninjaWhoWon.isMoving = true;
                    ninjaWhoWon.playAnimation("victory");
                    ninjaWhoWon.additionalSprName = "victory";
                    ninjaWhoWon.additionalSprFrame = 2;
                    ninjaWhoWon.additionalSprPosition = {x: 12, y:-3};
                    ninjaWhoWon.dontStandAnymore = true;
                }.bind(this), 2000);
                
                setTimeout(function() {
                    location.reload(false);
                }, 5000);
            }

            if (this.dontStandAnymore) return;
            
            // atk low
            if (isPressedAtkLow || (this.flip && this.goesTo == "S")) {
                this.isMoving = true;
                this.isStanding = false;
                this.playAnimation("atkL");
                this.additionalSprName = "atkL";
                this.additionalSprFrame = 2;
                this.additionalSprPosition = {x: 37, y:0};
                this.finalAdditionalMovement = 6;
                if (!this.flip) {
                    socket.emit("mov", "S", this.x);
                    this.lastMove = "S";
                }
                playSound(slashSnd1);
                return;
            }

            // atk high
            if (isPressedAtkHigh || (this.flip && this.goesTo == "W")) {
                this.isMoving = true;
                this.isStanding = false;
                this.playAnimation("atkH");
                this.additionalSprName = "atkH";
                this.additionalSprFrame = 1;
                this.additionalSprPosition = {x: 37, y:0};
                this.finalAdditionalMovement = 6;
                if (!this.flip) {
                    socket.emit("mov", "W", this.x);
                    this.lastMove = "W";
                }
                playSound(slashSnd2);
                return;
            }

            // movement
            if (!isPressedRight && !isPressedLeft) {
                this.isStanding = true; // lets assume hero is standing by default (will negate it if he moves)
                this.isRetreating = false; // it's only true if the player walks back
            }
            if (this.keyRightTimer > .02) {
                this.keyRightTimer = 0;
                if (isPressedRight && !isPressedLeft) {
                    this.lastkeyRightTimer = this.lastKeyTimer;
                    this.x += 1;
                    this.isStanding = false;
                }
            }
            if (this.keyLeftTimer > .04) {
                this.keyLeftTimer = 0;
                if (isPressedLeft && !isPressedRight) {
                    this.lastkeyLeftTimer = this.lastKeyTimer;
                    this.x -= 1;
                    this.isStanding = false;
                    this.isRetreating = true;
                }
            }

            // fast advance
            if (this.isStanding) {
                let hasAdvanced = false;
                let fastMov = "";
                if ((isPressedLeft && (this.lastKeyTimer - this.lastkeyLeftTimer < DOUBLE_PRESS_LIMIT) && !this.flip) || (this.flip && this.goesTo == "FL")) {
                    this.keyLeftTimer = this.lastkeyLeftTimer = 0;
                    this.playAnimation("fastL");
                    this.x -= FAST_ADVANCE_PX;
                    this.additionalAnimMovement = -.4;
                    hasAdvanced = true;
                    if (!this.flip) this.fastMov = "FL";
                }
                if ((isPressedRight && (this.lastKeyTimer - this.lastkeyRightTimer < DOUBLE_PRESS_LIMIT) && !this.flip) || (this.flip && this.goesTo == "FR")) {
                    this.keyRightTimer = this.lastkeyRightTimer = 0;
                    this.playAnimation("fastR");
                    this.x += FAST_ADVANCE_PX;
                    this.additionalAnimMovement = .4;
                    hasAdvanced = true;
                    if (!this.flip) this.fastMov = "FR";
                }
                if (hasAdvanced) {
                    this.isMoving = true;
                    this.isStanding = false;
                    if (!this.flip) {
                        socket.emit("mov", this.fastMov, this.x);
                    } else {
                        this.goesTo = "";
                    }
                    playSound(fastSlideSnd);
                    return;
                }
            }
            
            // server messages
            if (!this.flip) {
                if (isPressedLeft && this.lastMove != "L") {
                    socket.emit("mov", "L", this.x);
                    this.lastMove = "L";
                } else if (isPressedRight && this.lastMove != "R") {
                    socket.emit("mov", "R", this.x);
                    this.lastMove = "R";
                } else if (this.isStanding && this.lastMove != "ST") {
                    socket.emit("mov", "ST", this.x);
                    this.lastMove = "ST";
                }
            }

            // animation
            if (isPressedRight || isPressedLeft) {
                this.playAnimation("walk");
            } else {
                this.playAnimation("stand");
            }
        };
        
        
        // TODO: luisquin remove some keys
        kontra.keys.bind(["g", "h", "w", "s", "left", "right", "up", "down"], function(e) {
            e.preventDefault();
        });
        
        // std background
        let bgStd = kontra.sprite({
            x: 0,
            y: 0,
            enabled: true,
            image: kontra.assets.images.b1,
            render() {
                if (this.enabled) this.draw();
            }
        });
        
        // death background
        let bgEnding = kontra.sprite({
            x: 0,
            y: 0,
            enabled: false,
            image: kontra.assets.images.b2,
            render() {
                if (this.enabled) this.draw();
            }
        });
        
        // sword effect
        
        let swordSheet = kontra.spriteSheet({
            image: kontra.assets.images.w,
            frameWidth: 25,
            frameHeight: 25,
            animations: {
                hidden: {
                    frames: [INVISIBLE_FRAME],
                    frameRate: 0
                },
                death: {
                    frames: [3, INVISIBLE_FRAME],
                    frameRate: 1,
                    loop: false
                },
                fly: {
                    frames: [0, 1],
                    frameRate: 12
                },
                ground: {
                    frames: [2],
                    frameRate: 0
                }
            }
        });
        
        let sword = kontra.sprite({
            x: 0,
            y: 0,
            flip: false,
            animations: swordSheet.animations,
            render() {
                renderFlipped.call(this);
            }
        });
        
        let swordFly = kontra.sprite({
            x: 40,
            y: 55,
            dx: 1,
            dy: -3.5,
            ddy: .1,
            animations: swordSheet.animations,
            enabled: false,
            flip: false,
            update(dt) {
                if (!this.enabled) return;
                this.advance();
                if (this.y > 84) {
                    this.dy = this.dx = this.ddy = 0;
                    this.y = 84;
                    this.x = this.x | 0;
                    this.playAnimation("ground");
                }
            },
            render() {
                if (!this.enabled) return;
                
                renderFlipped.call(this);
            }
        });
        
        // slash effect
        
        let slashAnimations = {
            hidden: {
                frames: [INVISIBLE_FRAME],
                frameRate: 0
            },
            victory: {
                frames: [0, INVISIBLE_FRAME],
                frameRate: 6,
                loop: false
            },
            atkL: {
                frames: [1, INVISIBLE_FRAME],
                frameRate: 6,
                loop: false
            },
            atkH: {
                frames: [2, INVISIBLE_FRAME],
                frameRate: 6,
                loop: false
            }
        };
        
        let slashSheet = kontra.spriteSheet({
            image: kontra.assets.images.e,
            frameWidth: 40,
            frameHeight: 49,
            animations: slashAnimations
        });
        
        let slash = kontra.sprite({
            x: 0,
            y: 0,
            animations: slashSheet.animations
        });
        
        let slashSheetFlipped = kontra.spriteSheet({
            image: kontra.assets.images.e,
            frameWidth: 40,
            frameHeight: 49,
            animations: slashAnimations
        });
        
        let slashFlip = kontra.sprite({
            x: 0,
            y: 0,
            flip: true,
            animations: slashSheetFlipped.animations,
            render() {
                renderFlipped.call(this);
            }
        });
        
        // life meter
        
        let renderLifeMeter = function() {
            if (!this.enableDraw) return;
            
            this.draw();
            let ctx = kontra.context;
            ctx.fillStyle = "#323429";
            ctx.fillRect(this.x, this.y, (this.width*(100 - this.percent)/100) | 0, this.height);
        };
        
        let updateLifeMeter = function(dt) {
            if (!this.enabled) return;
            
            if (this.percent < 0) {
                this.percent = 0;
                this.enabled = false;
                this.isDead = true;
            }
            this.timer += dt;
            if (this.timer > .3) {
                this.timer = 0;
                if (this.percent < 30) this.enableDraw = !this.enableDraw;
            }
        }
        
        let heroLife = kontra.sprite({
            x: 8,
            y: 130,
            image: kontra.assets.images.l,
            percent: 100,
            timer: 0,
            enableDraw: true,
            enabled: true,
            update(dt) {
                updateLifeMeter.call(this, dt);
            },
            render() {
                renderLifeMeter.call(this);
            }
        });      
        
        let enemyLife = kontra.sprite({
            x: 112,
            y: 130,
            image: kontra.assets.images.l,
            percent: 100,
            timer: 0,
            enableDraw: true,
            enabled: true,
            update(dt) {
                updateLifeMeter.call(this, dt);
            },
            render() {
                renderLifeMeter.call(this);
            }
        });
        
        // hero
        
        let ninjaAnimations = {
            stand: {
                frames: [0],
                frameRate: 0
            },
            walk: {
                frames: [1, 0],
                frameRate: 3
            },
            fastL: {
                frames: [3, 3, 3, STOP_FRAME],
                frameRate: 8,
                loop: false
            },
            fastR: {
                frames: [4, 4, 4, STOP_FRAME],
                frameRate: 8,
                loop: false
            },
            block: {
                frames: [2, 2, 2, STOP_FRAME],
                frameRate: 8,
                loop: false
            },
            hit: {
                frames: [13, 13, 13, STOP_FRAME],
                frameRate: 8,
                loop: false
            },
            atkH: {
                frames: [7, 8, 8, STOP_FRAME],
                frameRate: 4,
                loop: false
            },
            atkL: {
                frames: [5, 5, 6, STOP_FRAME],
                frameRate: 3,
                loop: false
            },
            victory: {
                frames: [9, 9, 10],
                frameRate: 4,
                loop: false
            },
            death: {
                frames: [11, 11, 12],
                frameRate: 2,
                loop: false
            }
        };
        
        let heroSheet = kontra.spriteSheet({
            image: kontra.assets.images.g,
            frameWidth: 55,
            frameHeight: 55,
            animations: ninjaAnimations
        });
        
        let ninjaSheet = kontra.spriteSheet({
            image: kontra.assets.images.g,
            frameWidth: 55,
            frameHeight: 55,
            animations: ninjaAnimations
        });
        
        let hero = new NinjaSprite({
            x: 20,
            y: 55,
            flip: false,
            animations: heroSheet.animations,
            keys: { a: "a", d: "d", w: "w", s: "s" }
        });
        
        let enemy = new NinjaSprite({
            x: 20,
            y: 55,
            flip: true,
            goesTo: "",
            animations: ninjaSheet.animations,
            keys: {}
        });
        
        // intro "waiting" message
        
        let waiting = kontra.sprite({
            image: kontra.assets.images.i,
            frameWidth: 95,
            frameHeight: 6,
            timer: 0,
            timesToReload: 7,
            enableDraw: false,
            x: 33,
            y: 68,
            update(dt) {
                this.timer += dt;
                if (this.timer > .7) {
                    this.timer = 0;
                    this.enableDraw = !this.enableDraw;
                    if (this.timesToReload-- < 0) location.reload(false);
                }
            },
            render() {
                if (this.enableDraw) this.draw();
            }
        });
        
        let clickToStart = kontra.sprite({
            image: kontra.assets.images.q,
            frameWidth: 59,
            frameHeight: 6,
            x: 51,
            y: 68
        });
        
        // clamp sprites
        hero.position.clamp(-20, 0, CW - hero.width, CH - hero.height);
        enemy.position.clamp(-20, 0, CW - hero.width, CH - hero.height);
        
        let isEnemyHit = function() {
            let a = hero.realX + 34;
            let b = hero.realX + 59;
            let c = enemy.realX - 34;
            let d = enemy.realX - 14;
            
            return (b>c && b<d) || (a>c && a<d);
        };
        
        let isHeroHit = function() {
            let a = hero.realX + 16;
            let b = hero.realX + 34;
            let c = enemy.realX - 59;
            let d = enemy.realX - 34;
            
            return (b>c && b<d) || (a>c && a<d);
        };
        
        
        kontra.gameLoop({
            update: function(dt) {
                if (gameState == STATE_INTRO) {
                    waiting.update(dt);
                } else if (gameState == STATE_PLAY) {
                    let toUpdate = [hero, enemy, slash, slashFlip, sword, swordFly, heroLife, enemyLife];
                    toUpdate.forEach(spr => {
                        spr.update(dt);
                    });
                }
            },
            
            render: function() {
                if (gameState == STATE_CLICK) {
                    clickToStart.render();
                } else if (gameState == STATE_INTRO) {
                    waiting.render();
                } else if (gameState == STATE_PLAY) {
                    let toRender = [bgStd, heroLife, enemyLife, bgEnding, slash, slashFlip, swordFly, sword, hero, enemy];
                    toRender.forEach(spr => {
                        spr.render();
                    }, this);
                }
            }
        }).start();
    }
}

let g = new Game();