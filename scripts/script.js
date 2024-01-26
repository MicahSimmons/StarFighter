"use strict";

const Events = {
  NOP: 0,
  FRAME_TIMEOUT: 1,
  MOUSE_D: 2,
  MOUSE_U: 3,
  MOUSE_MV: 4,
  WINDOW_RESIZE: 5,
  FIRE: 6,
  GAME_START: 7,
  FUEL_EMPTY: 8,
  OXY_EMPTY: 9,
  FADE_DONE: 10,
  GAME_EXIT: 11,
  FTL_JUMP: 12,
  GOOD_HUNTING: 13,
  NICE_SHOT: 14,
  LOW_AMMO: 15,
  LOW_FUEL: 16,
  LOW_OXY: 17,
  FTL_STANDBY: 18,
  SHOW_CREDITS: 19
}

const States = {
  INIT: 0,
  MENU: 1,
  GAME_RUNNING: 2,
  GAME_OVER: 3,
  DEBRIEF: 4,
  CREDITS: 5
}

const Consts = {
  THRUST_POWER: 0.1,
  LAZER_SPEED: 8,
  LAZER_RANGE: 400,
  STAR_COUNT: 150,
  STAR_RANGE: 7000,
  ENEMY_COUNT: 15,
  ENEMY_SPEED_MAX: 2,
  ENEMY_MIN_RANGE: 1000,
  ENEMY_VAR_RANGE: 1500,
  ENEMY_BOX: {width:60, height:40},
  FTL_COUNT_MAX: 300,
  FTL_ARMED_RANGE: 400,
  FTL_READY_RANGE: 100
}

var init_model = {
  dom_id: "#",
  game_state: States.INIT,
  sound_enable: true,
  vbox: {width: 500, height: 500},
  view_center: {x: 0, y: 0},
  target: {x: 0, y: 0},
  avatar: {x: 0, y: 0, 
           rotation:0, 
           velocity:{x:0, y:0}
  },
  thruster_burn: false,
  score: 0,
  fuel: 120,
  oxy: 120,
  ammo: 100,
  shields: 100,

  lazers: [],
  stars: [],
  enemies: [],
  fade_to_black: 120,

  ftl_armed: false,
  ftl_ready: false,
  ftl_countdown: 120,

  explosions: [],
  voice_log: {
    good_hunting: false,
    nice_shot: false,
    low_ammo: false,
    low_fuel: false,
    low_oxy: false
  }
}

class Model {
  constructor (event_cb) {
    this.setDomTop = this.setDomTop.bind(this);
    this.setTargetLoc = this.setTargetLoc.bind(this);
    this.setVBox = this.setVBox.bind(this);
    this.toggleThrust = this.toggleThrust.bind(this);
    this.fire = this.fire.bind(this);
    this.spawnStars = this.spawnStars.bind(this);
    this.update = this.update.bind(this);

    this.event_cb = event_cb;
  }

  setDomTop(dom_id) {
    this.dom_id = dom_id;
  }

  setTargetLoc (x, y) {
    this.target.x = x;
    this.target.y = y;

    /* avatar always faces target.  Calculate angle of rotation in degrees, based on center of vbox. */
    let opp = (this.vbox.height / 2.0) - this.target.y;
    let adj = (this.vbox.width / 2.0) - this.target.x ;
    this.avatar.rotation = Math.atan2(opp, adj) * 180 / Math.PI;
    //console.log("opp:" + opp + " adj:" + adj + " rot:" + this.avatar.rotation);
  }

  setVBox (width, height) {
    this.vbox.width = width;
    this.vbox.height = height;
  }

  toggleThrust(fire_thruster) {
    if (this.fuel > 0) {
      this.thruster_burn = fire_thruster;
    } else {
      this.thruster_burn = false;
    }
  }

  fire () {
    if (this.ammo > 0) {
      this.ammo -= 1;
      if ((this.ammo < 30) && (this.voice_log.low_ammo == false)) {
        this.event_cb(Events.LOW_AMMO, {});
      }

      let burst = {
        x: this.avatar.x,
        y: this.avatar.y,
        rotation: this.avatar.rotation,
        velocity: Consts.LAZER_SPEED,
        range: Consts.LAZER_RANGE
      }

      this.lazers.push(burst)

      let sfx = document.getElementById("laser_shot");
      sfx.muted = !(this.sound_enable);
      sfx.currentTime = 0;
      sfx.play();
    }
  }

  spawnStars () {
    for (let i=0; i<Consts.STAR_COUNT; i++) {
      let distance = Consts.STAR_RANGE * Math.random();
      let direction = 2 * Math.PI * Math.random();
      let rotation = 2 * Math.PI * Math.random();
      let x_loc = distance * Math.sin(direction);
      let y_loc = distance * Math.cos(direction);
      let star = {
        x: x_loc, y: y_loc, rotation: rotation
      }
      this.stars.push(star);
    }
  }

  spawnEnemies () {
    for (let i=0; i<Consts.ENEMY_COUNT; i++) {

      let distance = (Consts.ENEMY_VAR_RANGE * Math.random()) + Consts.ENEMY_MIN_RANGE;
      let direction = 2 * Math.PI * Math.random();
      let rotation = 2 * Math.PI * Math.random();
      let x_loc = distance * Math.sin(direction);
      let y_loc = distance * Math.cos(direction);
      let speed = Consts.ENEMY_SPEED_MAX * Math.random();
      let x_vel = speed * Math.sin(rotation);
      let y_vel = speed * Math.cos(rotation);

      let enemy = {
        x: x_loc, y: y_loc, rotation: (rotation * 180 / Math.PI), velocity: {x:x_vel, y:y_vel}, health: 100
      }
      this.enemies.push(enemy);
    }
  }

  makeBoom (x, y) {
    let new_boom = {
      x: x-128,
      y: y-128,
      age: 0
    }
    this.explosions.push(new_boom);
  }

  update () {
    if (this.game_state == States.GAME_OVER) {
      if (this.fade_to_black-- <= 0) {
        this.event_cb(Events.FADE_DONE, {});
      }
      return;
    }

    let dist_to_base = Math.sqrt((this.avatar.x)**2 + (this.avatar.y)**2);
    if ((!this.ftl_armed) && (dist_to_base > Consts.FTL_ARMED_RANGE)) {
      this.event_cb(Events.GOOD_HUNTING, {});
      this.ftl_armed = true;
    }
    if ((this.ftl_armed) && (dist_to_base < Consts.FTL_READY_RANGE)) {
      if (this.ftl_ready == false) {
        this.event_cb(Events.FTL_STANDBY, {});
      }

      this.ftl_ready = true;
      this.ftl_countdown--;
    } else {
      this.ftl_ready = false;
      this.ftl_countdown = Consts.FTL_COUNT_MAX;
    }
    if (this.ftl_countdown <= 0) {
      this.event_cb(Events.FTL_JUMP, {});
    }


    if (this.oxy <= 0) {
      this.event_cb(Events.OXY_EMPTY, {});
    } else {
      this.oxy -= 1.0 / 60.0;
    }

    if ((this.oxy < 30) && (this.voice_log.low_oxy == false)) {
      this.event_cb(Events.LOW_OXY, {});
    }

    /* If user is burning fuel, correct velocity */
    if (this.thruster_burn) {
      let rad = this.avatar.rotation * Math.PI / 180;
      let y_thrust = Consts.THRUST_POWER * Math.sin(rad);
      let x_thrust = Consts.THRUST_POWER * Math.cos(rad);
      this.avatar.velocity.x -= x_thrust;
      this.avatar.velocity.y -= y_thrust;
      this.fuel -= Consts.THRUST_POWER / 2.0;

      if (this.was_burning == false) {
        this.was_burning = true;
        let sfx = document.getElementById("engine");
        sfx.muted = !(this.sound_enable);
        sfx.currentTime = 0;
        sfx.play();
      }

      if ((this.fuel < 30) && (this.voice_log.low_fuel == false)) {
        this.event_cb(Events.LOW_FUEL, {});
      }

      if (this.fuel <= 0) {
        this.thruster_burn = false;
        this.event_cb(Events.FUEL_EMPTY, {});
      }
    } else {
      this.was_burning = false;
      let sfx = document.getElementById("engine");
      sfx.pause();
    }

    /* Update avatar position */
    this.avatar.x += this.avatar.velocity.x;
    this.avatar.y += this.avatar.velocity.y;

    /* Recenter view on avatar */
    this.view_center = {x:this.avatar.x, y:this.avatar.y};

    /* Update Lazer positions */
    let lz_updates = [];
    this.lazers.forEach((burst) => {
      let rad = burst.rotation * Math.PI / 180;
      let y_thrust = Consts.LAZER_SPEED * Math.sin(rad);
      let x_thrust = Consts.LAZER_SPEED * Math.cos(rad);
      let new_burst = {
        x: burst.x - x_thrust,
        y: burst.y - y_thrust,
        rotation: burst.rotation,
        range: burst.range - Consts.LAZER_SPEED
      }

      if (new_burst.range > 0) {
        lz_updates.push(new_burst);
      }
    });
    this.lazers = lz_updates;

    /* Update Enemy Positions */
    let en_updates = [];
    this.enemies.forEach( (enemy) => {
      let x_pos = enemy.x - enemy.velocity.x;
      let y_pos = enemy.y - enemy.velocity.y;

      /* Lazer vs Enemy Collisions */
      let health = enemy.health;
      this.lazers.forEach( (lazer) => {
        let dist = Math.sqrt((lazer.x - enemy.x)**2 + (lazer.y - enemy.y)**2);
        if (dist < 30) {
          console.log("Dist:" + Math.floor(dist) +
                      " Enemy:(" + Math.floor(enemy.x) + "," + Math.floor(enemy.y) + ")" +
                      " Lazer:(" + Math.floor(lazer.x) + "," + Math.floor(lazer.y) + ")");
          health -= 50;
        }
      });
      if ((enemy.health > 0) && (health <= 0)) {
        let sfx = document.getElementById("explode");
        sfx.muted = !(this.sound_enable);
        sfx.currentTime = 0;
        sfx.play();

        this.makeBoom(enemy.x, enemy.y);

        this.score += 100;

        if ((this.voice_log.nice_shot == false) && (this.score >= 1000)) {
          this.event_cb(Events.NICE_SHOT, {});
        }
      }

      let new_enemy = {
        x: x_pos, y: y_pos, rotation: enemy.rotation, velocity: enemy.velocity, health:health
      }
      en_updates.push(new_enemy);
    })
    this.enemies = en_updates;

    /* Update Explosions */
    let new_booms = [];
    this.explosions.forEach( (boom) => {
      let updated = {
        x: boom.x, y: boom.y,
        age: (boom.age + 1)
      }
      if (updated.age < 64) {
        new_booms.push(updated);
      }
    });
    this.explosions = new_booms;
  }
}

class ViewMiniMap {
  constructor (dom_id) {
    this.dom_id = dom_id;
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);
    this.getDirection = this.getDirection.bind(this);
    this.getMiniX = this.getMiniX.bind(this);

    this.i = 0;
  }

  draw (model) {
    /* Create SVG Canvas */    
    let div = document.getElementById(this.dom_id.slice(1));
    let canvas = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    canvas.setAttribute("width", "200");
    canvas.setAttribute("height", "200");
    canvas.setAttribute("id", "svgmini");
    div.appendChild(canvas);

    /* Draw the circle border */
    let svg =d3.select("#svgmini");
    svg.append("circle")
       .attr("cy", "100")
       .attr("cx", "100")
       .attr("r", "100")
       .attr("stroke", "darkblue")
       .attr("stroke-width", "2")
       .attr("fill", "none");

    /* Draw Avatar Icon */
    svg.append("circle")
       .attr("cy", "100")
       .attr("cx", "100")
       .attr("r", "5")
       .attr("stroke", "darkblue")
       .attr("stroke-width", "2")
       .attr("fill", "darkblue"); 
  }

  getDist(obj, model) {
    let dist = Math.sqrt((obj.x - model.avatar.x)**2 + (obj.y - model.avatar.y)**2);
    return (dist < 2000) ? dist : 2000;
  }

  getDirection(obj, model) {
    let opp = obj.y - model.avatar.y ;
    let adj = obj.x - model.avatar.x  ;
    return Math.atan2(adj, opp);    
  }

  getMiniX(enemy, model) {
    let dist = this.getDist(enemy, model) / 20;
    let rad = this.getDirection(enemy, model);
    let x_loc = dist * Math.sin(rad);
    let x_trans = x_loc + 100;
    return x_trans;
  }

  getMiniY(enemy, model) {
    let dist = this.getDist(enemy, model) / 20;
    let rad = this.getDirection(enemy, model);
    let x_loc = dist * Math.cos(rad);
    let x_trans = x_loc + 100;
    return x_trans;
  }

  update (model) {
    let svg=d3.select("#svgmini");
    svg.selectAll(".svg_enemy")
      .remove()
      .data(model.enemies)
      .enter()
      .filter((d) => { return d.health > 0 })
      .append("circle")
      .attr("class", "svg_enemy")
      .attr("r", "5")
      .attr("fill", "red")
      .attr("cx", (d) => this.getMiniX(d, model))
      .attr("cy", (d) => this.getMiniY(d, model));

    svg.selectAll(".svg_base")
      .remove()
      .data([{x:0, y:0}])
      .enter()
      .append("circle")
      .attr("class", "svg_base")
      .attr("r", "5")
      .attr("fill", "cyan")
      .attr("cx", (d) => this.getMiniX(d, model))
      .attr("cy", (d) => this.getMiniY(d, model));
  }
}

class ViewGame {
  constructor () {
    this.posToVB = this.posToVB.bind(this);
  }

  draw(model) {
    let top = $(model.dom_id);
    top.html("");

    /* Create Layers */
    [
      "layer_stars", "layer_av", "layer_lz", "layer_boom", "layer_enemy", "layer_ui"
    ].forEach( (name, idx) => {
      let layer = $("<div>").attr("id", name)
                                  .addClass("layer")
                                  .css("z-index", idx)
      top.append(layer);
    });

    /* Draw Star background */
    model.stars.forEach( (star, idx) => {
      let obj = $("<div>").attr("id", "star"+idx).addClass("sprite").addClass("bg_star");
      $("#layer_stars").append(obj);
    });

    /* Add sprites to Avatar Layer */
    [
      "thrust", "avatar", "ui_target", "ui_start"
    ].forEach((div_name) => {
      let obj = $("<div>").attr("id", div_name).addClass("sprite");
      $("#layer_av").append(obj);
    });

    /* Display Enemy Targets */
    let en_layer = $("#layer_enemy");
    model.enemies.forEach( (enemy, idx) => {
      let obj = $("<div>").attr("id", "enemy"+idx).addClass("sprite").addClass("enemy");
      let xform_str = "rotate(" + enemy.rotation + "deg)";
      obj.css("transform", xform_str);
      en_layer.append(obj);
    });


    /* Add objects to UI Layer */
    $("#layer_ui").css("display", "flex")
                  .css("flex-direction", "column")
                  .css("justify-content", "space-between")
                  .css("pointer-events", "none");
    let hdr = $("<div>").css("width", "100%").css("position", "relative");
    hdr.css("display", "flex").css("flex-direction", "row").css("justify-content", "space-between");
    $("#layer_ui").append(hdr);

   let score = $("<div>").attr("id", "score")
                        .addClass("text");
    hdr.append(score);

    let ftl = $("<div>").attr("id", "ftl_status").addClass("text");
    hdr.append(ftl);

    let map = $("<div>").attr("id", "map");
    hdr.append(map);

    /*** Mini Map ****/
    this.mini = new ViewMiniMap("#map");
    this.mini.draw(model);
    /*** End of Mini Map ****/

    let foot = $("<div>").css("width", "100%").css("position", "relative");
    foot.css("display", "flex").css("flex-direction", "row").css("justify-content", "space-around");
    $("#layer_ui").append(foot);

    let fuel = $("<div>").attr("id", "fuel").addClass("text");
    let oxy = $("<div>").attr("id", "oxy").addClass("text");
    let ammo = $("<div>").attr("id", "ammo").addClass("text");
    let shield = $("<div>").attr("id", "shield").addClass("text");
    foot.append([fuel, oxy, ammo, shield]);
  }

  // input {x:, y:}
  // output {top:, left:}
  posToVB (model, sprite_pos) {
    let view_center = model.view_center;
    let vbox = model.vbox;

    return {
      left: sprite_pos.x - view_center.x + (vbox.width / 2),
      top: sprite_pos.y - view_center.y + (vbox.height / 2)
    }
  }

  update(model) {
    $("#ui_target").css({top:model.target.y, left:model.target.x});

    // Adjust stars to give illusion of movement
    model.stars.forEach( (star, idx) => {
      let star_id = "#star"+idx;
      $(star_id).css(this.posToVB(model, star));
    });

    $(".explosion").remove();
    model.explosions.forEach( (boom) => {
      let boom_pos = this.posToVB(model, boom);
      console.log(boom_pos);
      let obj = $("<div>").addClass("explosion").css(boom_pos);

      let counter = ((120*30) - Math.floor(30 * model.oxy));
      let x_off = 256 * (boom.age % 8);
      let y_off = 256 * (Math.floor(boom.age / 8) % 8);
      let boom_str = "-" + x_off + "px -" + y_off + "px";
      obj.css("background-position", boom_str);

      $("#layer_boom").append(obj);
    });

    // Show Enemies
    model.enemies.forEach( (enemy, idx) => {
      let enemy_id = "#enemy"+idx;
      $(enemy_id).css(this.posToVB(model, enemy));
      $(enemy_id).css("visibility", (enemy.health > 0) ? "visible" : "hidden")
    });

    // Need to add 90 degress since avatar sprite is north oriented
    let mod_rotation = model.avatar.rotation - 90;
    let av_rotation = "rotate(" + mod_rotation + "deg)";
    $("#avatar").css(this.posToVB(model, model.avatar)).css("transform", av_rotation);

    let thrust_xform = av_rotation + " translateY(30px) ";
    $("#thrust").css(this.posToVB(model, model.avatar))
                .css("transform", thrust_xform)
                .css("visibility", (model.thruster_burn) ? "visible" : "hidden");

    $("#ui_start").css(this.posToVB(model, {x:0, y:0}));

    /* Update Lazers */
    $("#layer_lz").html("");
    model.lazers.forEach( (burst, idx) => {
      let lz = $("<div>").addClass("sprite").addClass("lazer");
      lz.css(this.posToVB(model, burst));
      let mod_rotation = burst.rotation - 90;
      let lz_rotation = "rotate(" + mod_rotation + "deg)";
      lz.css("transform", lz_rotation);
      $("#layer_lz").append(lz);
    });

    $("#score").html("Score: " + Math.floor(model.score));

    if (model.ftl_ready) {
      $("#ftl_status").css("visibility", "visible")
                      .css({color:"blue", font_size:"2rem"})
                      .text("FTL Drive Engaged.  Jump in " + Math.floor(model.ftl_countdown / 60.0) + " seconds.");
    } else {
      $("#ftl_status").css("visibility", "hidden");
    }

    this.mini.update(model);
    $("#fuel").html("Fuel: " + Math.floor(model.fuel));
    $("#oxy").html("O2: " + Math.floor(model.oxy));
    $("#ammo").html("Ammo: " + Math.floor(model.ammo));
    $("#shield").html("Shields: " + Math.floor(model.shields));
  }
}

class ViewMenu {
  constructor() {
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);
  }

  draw (model) {
    let top = $(model.dom_id);
    top.html("");

    let layer = $("<div>").attr("id", "menu")
                                .addClass("layer")
                                .addClass("menu")
                                .css("z-index", 0)
    top.append(layer);

    let title = $("<div>").html("<h1>Operation: Star Fighter</h1>")

    let buttons = $("<div>").addClass("menu");
    let start_btn = $("<div>").attr("id", "menu_start").addClass("menubtn").text("Start Mission");
    let credits_btn = $("<div>").attr("id", "show_credits").addClass("menubtn").text("Credits");
    buttons.append([start_btn, credits_btn]);

    let instructions = $("<div>").addClass("menutext").html("Destroy Alien Ships.  <br>Return to Base before Fuel and Life Support is exhausted.<ul><li>Mouse : Manuever</li><li>Mouse Btn : Thrust</li><li>Spacebar : Fire Weapons</li></ul>");

    layer.append([title, buttons, instructions]);
  }

  update (model) {

  }
}

class ViewFade {
  constructor () {
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);    
  }

  draw (model) {
    /* Just keep whatever was there */
  }

  update (model) {
    let op = model.fade_to_black / 120.0;
    $(".layer").css("opacity", op);
  }
}

class ViewReport{
  constructor () {
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);    
  }

  draw (model) {
    let top = $(model.dom_id);
    top.html("");

    let layer = $("<div>").attr("id", "menu")
                            .addClass("layer")
                            .addClass("menu")
                            .css("z-index", 0);
    top.append(layer);

    let result = $("<div>").addClass("menu");
    if (model.fuel <= 0) {
      result.append($("<div>").css("color", "red").html("<h2>Fuel Cells Depleted</h2>"));
    }
    if (model.oxy <= 0) {
      result.append($("<div>").css("color", "red").html("<h2>Oxygen Tanks Depleted</h2>"));
    }
    if ((model.fuel > 0) && (model.oxy > 0)) {
      result.append($("<div>").css("color", "cyan").html("<h2>FTL Jump: Successful (x2 Bonus)</h2>"));
    } else {
      result.append($("<div>").css("color", "red").html("<h3>You're Dead.</h3>"));
    }

    let score = $("<div>").addClass("menu");
    score.append($("<div>").html("<h1>Score: " + model.score + "</h1>"));

    let buttons = $("<div>").addClass("menu");
    let exit_btn = $("<div>").attr("id", "menu_done").addClass("menubtn").text("Exit");
    buttons.append([exit_btn]);

    layer.append([result, score, buttons]);
  }

  update (model) {

  }
}

class ViewCredits {
  constructor () {
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);    
  }

  draw (model) {
    let top = $(model.dom_id);
    top.html("");

    let layer = $("<div>").attr("id", "menu")
                            .addClass("layer")
                            .addClass("menu")
                            .css("z-index", 0);
    top.append(layer);

    let score = $("<div>").addClass("menu");
    let credit_text = "<p>Operation: Star Fighter</p><p> designed and implemented by Micah Simmons for SRJC CS42 Spring 2022</p>"
    credit_text += '<p>The following third-party resources were used in the creation of this game.  All assets are believed to be licensed by public domain.</p>';
    credit_text += "<ul>";
    credit_text += '<li><a href="https://opengameart.org/content/space-shooter-redux">Space Shooter Redux</a>, asset pack, by "<a href="https://kenney.nl">Kenney</a>"</li>';
    credit_text += '<li><a href="https://opengameart.org/content/free-music-pack">Great Mission - Free Music Pack</a> by Alexander Ehlers</li>';
    credit_text += '<li><a href="https://opengameart.org/content/engine-sound">Engine Sound</a> by Kurt</li>';
    credit_text += '<li><a href="https://opengameart.org/content/big-explosion">Big Explosion (audio)</a> by Blender Foundation</li>';
    credit_text += '<li><a href="https://opengameart.org/content/2d-explosion-animations-frame-by-frame">2D Explosion Animations</a> by Sinestasia</li>';
    credit_text += '<li><a href="https://15.ai">Deep Throat Voice Synthesis</a> by Fifteen.ai</li>';

    credit_text += "</ul>"


    score.append($("<div>").html(credit_text));

    let buttons = $("<div>").addClass("menu");
    let exit_btn = $("<div>").attr("id", "exit_credits").addClass("menubtn").text("Exit");
    buttons.append([exit_btn]);

    layer.append([score, buttons]);
  }

  update (model) {

  }  
}

class View {
  constructor() {
    this.draw = this.draw.bind(this);
    this.update = this.update.bind(this);

    this.game_menu = new ViewMenu();
    this.game_view = new ViewGame();
    this.game_over = new ViewFade();
    this.mission_report = new ViewReport();
    this.credits = new ViewCredits();
  }

  draw (model) {
    switch (model.game_state) {
      case States.MENU:
        this.game_menu.draw(model);
        break;
      case States.GAME_RUNNING:
        this.game_view.draw(model);
        break;
      case States.GAME_OVER:
        this.game_over.draw(model);
        break;
      case States.DEBRIEF:
        this.mission_report.draw(model);
        break;
      case States.CREDITS:
        this.credits.draw(model);
        break;
    }
  }

  update (model) {
    switch (model.game_state) {
      case States.MENU:
        this.game_menu.update(model);
        break;
      case States.GAME_RUNNING:
        this.game_view.update(model);
        break;
      case States.GAME_OVER:
        this.game_over.update(model);
        break;
      case States.DEBRIEF:
        this.mission_report.update(model);
        break;
      case States.CREDITS:
        this.credits.update(model);
        break;
    }
  }

  voice (model, event) {
    let sound_id = "";
    switch (event) {
      case Events.GOOD_HUNTING:
        model.voice_log.good_hunting = true;
        sound_id = "tts_hunting"; 
        break;
      case Events.NICE_SHOT:
        model.voice_log.nice_shot = true;
        sound_id = "tts_nice_shot";
        break;
      case Events.LOW_AMMO:
        model.voice_log.low_ammo = true;
        sound_id = "tts_low_ammo";
        break;
      case Events.LOW_FUEL:
        model.voice_log.low_fuel = true;
        sound_id ="tts_low_fuel";
        break;
      case Events.LOW_OXY:
        model.voice_log.low_oxy = true;
        sound_id ="tts_low_oxy";
        break;
      case Events.FTL_JUMP:
        sound_id = "tts_game_over";
        break;
      case Events.FTL_STANDBY:
        model.voice_log.standby = true;
        sound_id = "tts_standby";
        break;
    }

    if (sound_id != "") {
      let sfx = document.getElementById(sound_id);
      sfx.muted = !(model.sound_enable);
      sfx.currentTime = 0;
      sfx.play();
    }

  }
}

class Control {
  constructor(event_cb) {
    this.event_cb = event_cb;
    this.attach = this.attach.bind(this);
    this.run = this.run.bind(this);
  }

  attach (model) {
    var top = $(model.dom_id);
    top.off();
    $(window).off();

    top.mousedown(() => this.event_cb(Events.MOUSE_D, {}));
    top.mouseup(() => this.event_cb(Events.MOUSE_U, {}));
    top.mousemove((event) => {
      var parentOffset = top.parent().offset(); 
      var relX = event.pageX - parentOffset.left;
      var relY = event.pageY - parentOffset.top;
      this.event_cb(Events.MOUSE_MV, {x:relX, y:relY})
    });
    $(window).keydown((event) => {
      switch (event.key) {
        case ' ':
          this.event_cb(Events.FIRE, {});
          break;
      }
    });


    $(window).resize(() => {
      this.event_cb(Events.WINDOW_RESIZE, {
        width:top.width(),
        height:top.height()
      })
    });

    $("#menu_start").click(() => this.event_cb(Events.GAME_START, {}));
    $("#menu_done").click(() => this.event_cb(Events.GAME_EXIT, {}));
    $("#show_credits").click(() => this.event_cb(Events.SHOW_CREDITS, {}));
    $("#exit_credits").click(() => this.event_cb(Events.GAME_EXIT, {}));

  }

  run() {
    setInterval(() => this.event_cb(Events.FRAME_TIMEOUT, {}), 17);
  }

}

class GameApp {
  constructor(dom_id) {
    this.dom_id = dom_id;
    this.fsm = this.fsm.bind(this);
    this.q = this.q.bind(this);
    this.run = this.run.bind(this);

    this.control = new Control(this.q);
    this.view = new View();

    this.model = new Model(this.q);
    Object.assign(this.model, JSON.parse(JSON.stringify(init_model)));
    this.model.setDomTop(dom_id);
  }



  fsm (event, data) {
    let new_state = this.model.game_state;

    /* Handle Event */
    switch (this.model.game_state) {
      case States.INIT:
        switch (event) {
          case Events.FRAME_TIMEOUT:
            Object.assign(this.model, JSON.parse(JSON.stringify(init_model)));
            this.model.setDomTop(this.dom_id);

            new_state = States.MENU;
            break;
        }
        break;
      case States.MENU:
        switch (event) {
          case Events.GAME_START:
            this.model.setVBox($(this.model.dom_id).width(), $(this.model.dom_id).height());
            this.model.spawnStars();
            this.model.spawnEnemies();
            
            console.log("Starting music");
            let sfx = document.getElementById("bgm_music");
            sfx.volume = 0.07;
            sfx.muted = !(this.model.sound_enable);
            sfx.currentTime = 0;
            sfx.play();

            new_state = States.GAME_RUNNING;
            break;
          case Events.SHOW_CREDITS:
            new_state = States.CREDITS;
            break;
        }
        break;
      case States.GAME_RUNNING:
        switch (event) {
          case Events.FRAME_TIMEOUT:
            this.model.update();
            this.view.update(this.model);
            break;
          case Events.MOUSE_D:
            this.model.toggleThrust(true);
            break;
          case Events.MOUSE_U:
            this.model.toggleThrust(false);
            break;
          case Events.MOUSE_MV:
            //console.log("Mouse moved to (" + data.x + "," + data.y + ")");
            this.model.setTargetLoc(data.x, data.y);
            break;
          case Events.WINDOW_RESIZE:
            this.model.setVBox(data.width, data.height);
            break;
          case Events.FIRE:
            this.model.fire();
            break;
          case Events.FTL_JUMP:
            this.model.score = this.model.score * 2;
            this.view.voice(this.model, Events.FTL_JUMP);
            new_state = States.GAME_OVER;
            break;
          case Events.FUEL_EMPTY:
          case Events.OXY_EMPTY:
            new_state = States.GAME_OVER;
            break;
          case Events.GOOD_HUNTING:
          case Events.NICE_SHOT:
          case Events.LOW_AMMO:
          case Events.LOW_FUEL:
          case Events.LOW_OXY:
          case Events.FTL_STANDBY:
            this.view.voice(this.model, event);
            break;
        }
        break;
        
      case States.GAME_OVER:
        switch (event) {
          case Events.FRAME_TIMEOUT:
            this.model.update();
            this.view.update(this.model);
            break;
          case Events.FADE_DONE:
              let sfx = document.getElementById("bgm_music");
              sfx.pause();

              sfx = document.getElementById("engine");
              sfx.pause();

            new_state = States.DEBRIEF;
            break;
        }
        break;

      case States.DEBRIEF:
        switch (event) {
          case Events.GAME_EXIT:
            new_state = States.INIT;
            break;
        }
        break;

      case States.CREDITS:
        switch (event) {
          case Events.GAME_EXIT:
            new_state = States.INIT;
            break;
        }
        break;

      default:
        console.log("Unknown Game State:" + this.model.game_state);
        break;
    }

    if (new_state != this.model.game_state) {
      this.model.game_state = new_state;
      this.view.draw(this.model);
      this.control.attach(this.model);
    }

  }

  q(event, data) {
    setTimeout(() => this.fsm(event, data), 0);
  }

  run() {
    this.control.run();
  }
}