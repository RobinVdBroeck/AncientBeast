/*	Class UI
*
*	Object containing UI DOM element, update functions and event managment on UI.
*
*/
var UI = Class.create({

	/*	Attributes
	*	
	*	NOTE : attributes and variables starting with $ are jquery element 
	*	and jquery function can be called dirrectly from them.
	*
	*	$display :		UI container 
	*	$queue :		Queue container
	*	$textbox :		Chat and log container
	*	$activebox :	Current active creature panel (left panel) container
	*	$dash :			Overview container
	*	$grid :			Creature grid container
	*
	*	selectedCreature : 	String : 	ID of the visible creature card
	*	selectedPlayer : 	Integer : 	ID of the selected player in the dash
	*
	*/


	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(){
		this.$display = $j("#ui");
		this.$queue = $j("#queuewrapper");
		this.$dash = $j("#dash");
		this.$grid = $j("#creaturegrid");
		this.$activebox = $j("#activebox");

		//Chat
		this.chat = new Chat();

		//Buttons Objects
		this.buttons = [];
		this.abilitiesButtons = [];

		//Dash Button
		this.btnToggleDash = new Button({
			$button : $j(".toggledash"),
			click : function(e){G.UI.toggleDash();},
		});
		this.buttons.push(this.btnToggleDash);

		//Audio Button
		this.btnFlee = new Button({
			$button : $j("#audio.button"),
			click : function(e){ if(!G.UI.dashopen){
				G.UI.showMusicPlayer();
			}}
		});
		this.buttons.push(this.btnFlee);

		//Skip Turn Button
		this.btnSkipTurn = new Button({
			$button : $j("#skip.button"),
			click : function(e){ if(!G.UI.dashopen){
				if(G.turnThrottle) return;
				G.gamelog.add({action:"skip"});
				G.skipTurn();
			}},
		});
		this.buttons.push(this.btnSkipTurn);

		//Delay Creature Button
		this.btnDelay = new Button({
			$button : $j("#delay.button"),
			click : function(e){ if(!G.UI.dashopen){ 
				if(G.turnThrottle) return;
				if(G.activeCreature.hasWait || !G.activeCreature.delayable || G.delayQueue.length + G.queue.length==0 ) return;
				G.gamelog.add({action:"delay"});
				G.delayCreature();
			}},
		});
		this.buttons.push(this.btnDelay);

		//Flee Match Button
		this.btnFlee = new Button({
			$button : $j("#flee.button"),
			click : function(e){ if(!G.UI.dashopen){
				if( G.turn < G.minimumTurnBeforeFleeing ){
					alert("You cannot flee the match in the first 10 rounds.");
					return;
				}
				if( G.activeCreature.player.isLeader() ){
					alert("You cannot flee the match while being in lead.");
					return;
				}

				if(window.confirm("Are you sure you want to flee the match?")){
					G.gamelog.add({action:"flee"});
					G.activeCreature.player.flee();
				}
			}},
			state : "disabled",
		});
		this.buttons.push(this.btnFlee);

		//ProgessBar
		this.energyBar = new ProgessBar({$bar : $j("#leftpanel .progressbar .bar"), color : "yellow" });
		this.timeBar = new ProgessBar({$bar : $j("#rightpanel .progressbar .timebar"), width : 9 , color : "white" });
		this.poolBar = new ProgessBar({$bar : $j("#rightpanel .progressbar .poolbar"), color : "grey" });

		//Binding Hotkeys
		$j(document).on('keypress', function(e){
			if(G.freezedInput) return;

			var keypressed = e.which;
			// console.log(keypressed);

			hotkeys = {
				overview: 113, //Q
				attack: 119, //W
				ability: 101, //E
				ultimate: 114, //R
				audio: 97, //A
				skip: 115, //S
				delay: 100, //D
				flee: 102, //F
				chat: 13, //return
				pause: 112 //P
			};

			var prevD = false;

			$j.each(hotkeys,function(k,v){
				if(v==keypressed){
					switch(k){
						case "attack": G.UI.abilitiesButtons[1].triggerClick(); break;
						case "ability": G.UI.abilitiesButtons[2].triggerClick(); break;
						case "ultimate": G.UI.abilitiesButtons[3].triggerClick(); break;
						case "overview": G.UI.btnToggleDash.triggerClick(); break;
						case "skip": G.UI.btnSkipTurn.triggerClick(); break;
						case "delay": G.UI.btnDelay.triggerClick(); break;
						case "flee": G.UI.btnFlee.triggerClick(); break;
						case "chat": G.UI.chat.toggle(); break;
						case "pause": G.togglePause(); break;
					}
					prevD = true;
				}
			});
			if(prevD){
				e.preventDefault();
				return false;
			}
		});
		
		//Mouse Shortcut
		$j("#dash").bind('mouseup', function(e){
			if(G.freezedInput) return;

			switch (e.which) {
				case 1:
					//Left mouse button pressed
					break;
				case 2:
					//Middle mouse button pressed
					break;
				case 3:
					//Right mouse button pressed
					if(G.UI.dashopen){
						G.UI.closeDash();
					}
					break;
			}
		});


		for (var i = 0; i < 4; i++) {
			var b = new Button({
				$button : $j("#abilities > div:nth-child("+(i+1)+") > .ability"),
				abilityId : i,
				css : {
					disabled  	: {},
					glowing  	: { "cursor": "pointer" },
					selected  	: {},
					active 		: {},
					noclick 	: {},
					normal 		: { "cursor": "default" },
				}
			});
			this.buttons.push(b);
			this.abilitiesButtons.push(b);
		};

		this.$dash.children("#playertabswrapper").addClass("numplayer"+G.nbrPlayer);

		this.selectedCreature = "";
		this.selectedPlayer = 0;
		this.selectedAbility = -1;

		this.queueAnimSpeed = 500; //ms
		
		this.materializeToggled = false;
		this.dashopen = false;

		if(G.turnTimePool) $j(".turntime").text(zfill(Math.floor(G.turnTimePool/60),2)+":"+zfill(G.turnTimePool%60,2));
		if(G.timePool) $j(".timepool").text(zfill(Math.floor(G.timePool/60),2)+":"+zfill(G.timePool%60,2));			

		//Show UI
		this.$display.show();
	},

	
	resizeDash: function(){
		var zoom1 = $j("#cardwrapper").innerWidth() / $j("#card").outerWidth();
		var zoom2 = $j("#cardwrapper").innerHeight() / ( $j("#card").outerHeight() + $j("#materialize_button").outerHeight() );
		var zoom = Math.min(zoom1,zoom2);
		zoom = Math.min(zoom,1);
		$j("#cardwrapper_inner").css({ 
			zoom: zoom, 
			// "left": ($j("#cardwrapper").innerWidth()-$j("#card").innerWidth()*zoom)/2,
			// position: "absolute",
			// margin: 0
		});

		var zoom1 = $j("#creaturegridwrapper").innerWidth()/$j("#creaturegrid").innerWidth();
		var zoom2 = $j("#creaturegridwrapper").innerHeight()/$j("#creaturegrid").innerHeight();
		zoom = Math.min(zoom1,zoom2);
		zoom = Math.min(zoom,1);
		$j("#creaturegrid").css({ 
			scale: zoom, 
			"left": ($j("#creaturegridwrapper").innerWidth()-$j("#creaturegrid").innerWidth()*zoom)/2,
			position: "absolute",
			margin: 0
		});
	},


	/*	showCreature(creatureType,player)
	*	
	*	creatureType : 	String : 	Creature type
	*	player : 		Integer : 	Player ID
	*
	* 	Query a creature in the available creatures of the active player
	*
	*/
	showCreature: function(creatureType,player){

		this.dashopen = true;

		//Set dash active
		this.$dash.addClass("active");
		this.$dash.children("#tooltip").removeClass("active");
		this.$dash.children("#playertabswrapper").addClass("active");
		this.changePlayerTab(G.activeCreature.team);
		this.resizeDash();

		this.$dash.children("#playertabswrapper").children(".playertabs").unbind('click').bind('click',function(e){
			if(G.freezedInput) return;
			G.UI.showCreature("--",$j(this).attr("player")-0);
		});

		//Change player infos
		for (var i = G.players.length - 1; i >= 0; i--) {
			$j("#dash .playertabs.p"+i+" .vignette").css("background-image","url('"+G.players[i].avatar+"')");
			$j("#dash .playertabs.p"+i+" .name").text(G.players[i].name);
			$j("#dash .playertabs.p"+i+" .plasma").text("Plasma "+G.players[i].plasma);
			$j("#dash .playertabs.p"+i+" .score").text("Score "+G.players[i].getScore().total);
		};

		//Change to the player tab
		if(player != G.UI.selectedPlayer){this.changePlayerTab(player);}

		this.$grid.children(".vignette").removeClass("active")
		.filter("[creature='"+creatureType+"']").addClass("active");

		this.selectedCreature = creatureType;

		var stats = G.retreiveCreatureStats(creatureType);

		//TODO card animation
		if( $j.inArray(creatureType, G.players[player].availableCreatures)>0 || creatureType=="--"){
			//If creature is available

			//Retreive the summoned creature if it exists
			var crea = undefined;
			G.UI.selectedCreatureObj = undefined;
			G.players[player].creatures.each(function(){
				if(this.type == creatureType){
					crea = this;
					G.UI.selectedCreatureObj = this;
				}
			});

			//Recto
			$j("#card .card.recto").css({"background-image":"url('../bestiary/"+stats.name+"/artwork.jpg')"});
			$j("#card .card.recto .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0,1));
			$j("#card .card.recto .type").text(stats.type);
			$j("#card .card.recto .name").text(stats.name);
			$j("#card .card.recto .hexs").text(stats.size+"H");

			//Verso
			$j.each(stats.stats,function(key,value){
				var $stat = $j("#card .card.verso ."+key+" .value");
				$stat.removeClass("buff debuff");
				if(crea){
					if(key=="health"){
						$stat.text(crea.health+"/"+crea.stats[key]);
					}else if(key=="movement"){
						$stat.text(crea.remainingMove+"/"+crea.stats[key]);
					}else if(key=="energy"){
						$stat.text(crea.energy+"/"+crea.stats[key]);
					}else if(key=="endurance"){
						$stat.text(crea.endurance+"/"+crea.stats[key]);
					}else{
						$stat.text(crea.stats[key]);
					}
					if(crea.stats[key]>value){ //Buff
						$stat.addClass("buff");
					}else if(crea.stats[key]<value){ //Debuff
						$stat.addClass("debuff");
					}
				}else{
					$stat.text(value);
				}
			});
			$j.each(abilities[stats.id],function(key,value){
				$ability = $j("#card .card.verso .abilities .ability:eq("+key+")");
				$ability.children('.icon').css({"background-image":"url('../bestiary/"+stats.name+"/"+key+".svg')"});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").text(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").text(stats.ability_info[key].info);
			});

			var summonedOrDead = false;
			G.players[player].creatures.each(function(){
				if(this.type == creatureType){
					summonedOrDead = true;
				}
			});

			//Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
		
			if(G.activeCreature.player.getNbrOfCreatures() > G.creaLimitNbr){
				$j('#materialize_button p').text(G.msg.ui.dash.materialize_overload);
			}else if(
				!summonedOrDead && 
				G.activeCreature.player.id==player && 
				G.activeCreature.type=="--" &&
				G.activeCreature.abilities[3].used==false
			  )
			{	
				var lvl = creatureType.substring(1,2)-0;
				var size = G.retreiveCreatureStats(creatureType).size-0;
				plasmaCost = lvl+size;

				//Messages
				if(plasmaCost>G.activeCreature.player.plasma){
					$j('#materialize_button p').text("Low Plasma! Cannot materialize the selected unit");
				}else{
					$j('#materialize_button p').text("Materialize unit at target location for "+plasmaCost+" plasma");

					$j('#materialize_button').addClass("glowing");

					//Bind button
					$j('#materialize_button').bind('click',function(e){
						if(G.freezedInput) return;
						G.UI.materializeToggled = true;
						G.UI.selectAbility(3);
						G.UI.closeDash(true);
						G.activeCreature.abilities[3].materialize(G.UI.selectedCreature);
					});
				}

			}else{
				if (
					G.activeCreature.player.id==player && 
					G.activeCreature.type=="--" &&
					G.activeCreature.abilities[3].used==true
				){
					$j('#materialize_button p').text("Materialization has already been used this round");
				}else if(
					G.activeCreature.player.id==player && 
					G.activeCreature.type=="--"
				){
					$j('#materialize_button p').text("Please select an available unit from the left grid");
				}else if (G.activeCreature.type!="--"){
					$j('#materialize_button p').text("The current active unit cannot materialize others");
				}else if (
					G.activeCreature.type=="--" &&
					G.activeCreature.player.id!=player
				){
					$j('#materialize_button p').text("Switch to your own tab to be able to materialize");
					$j('#materialize_button').addClass("glowing");
					//Bind button
					$j('#materialize_button').bind('click',function(e){
						G.UI.showCreature("--",G.activeCreature.player.id)
					});
				}
			}

		}else{
			
			//Recto
			$j("#card .card.recto").css({"background-image":"url('../bestiary/"+stats.name+"/artwork.jpg')"});
			$j("#card .card.recto .section.info").removeClass("sin- sinA sinE sinG sinL sinP sinS sinW").addClass("sin"+stats.type.substring(0,1));
			$j("#card .card.recto .type").text(stats.type);
			$j("#card .card.recto .name").text(stats.name);
			$j("#card .card.recto .hexs").text(stats.size+"H");

			//Verso
			$j.each(stats.stats,function(key,value){
				var $stat = $j("#card .card.verso ."+key+" .value");
				$stat.removeClass("buff debuff");
				$stat.text(value);
			});

			//Abilities
			$j.each(stats.ability_info,function(key,value){
				$ability = $j("#card .card.verso .abilities .ability:eq("+key+")");
				$ability.children('.icon').css({"background-image":"url('../bestiary/"+stats.name+"/"+key+".svg')"});
				$ability.children(".wrapper").children(".info").children("h3").text(stats.ability_info[key].title);
				$ability.children(".wrapper").children(".info").children("#desc").html(stats.ability_info[key].desc);
				$ability.children(".wrapper").children(".info").children("#info").html(stats.ability_info[key].info);
			});

			//Materialize button
			$j('#materialize_button').removeClass("glowing").unbind('click');
			$j('#materialize_button p').text("This unit is currently under development");
		}
	},


	selectAbility: function(i){
		if( this.selectedAbility > -1 )
			this.abilitiesButtons[this.selectedAbility].changeState("normal");
		this.selectedAbility = i;
		if( i>-1 )
			this.abilitiesButtons[i].changeState("active");
	},


	/*	changePlayerTab(id)
	*
	*	id : 	Integer : 	player id
	*
	*	Change to the specified player tab in the dash
	*
	*/
	changePlayerTab: function(id){
		this.selectedPlayer = id;
		this.$dash //Dash class
		.removeClass("selected0 selected1 selected2 selected3")
		.addClass("selected"+id);

		this.$grid.find(".vignette") //vignettes class
		.removeClass("active dead queued notsummonable")
		.addClass("locked");

		$j("#tabwrapper").show();
		$j("#musicplayerwrapper").hide();

		//change creature status
		G.players[id].availableCreatures.each(function(){
			G.UI.$grid.find(".vignette[creature='"+this+"']").removeClass("locked");

			var lvl = this.substring(1,2)-0;
			var size = G.retreiveCreatureStats(this).size-0;
			plasmaCost = lvl+size;

			if( plasmaCost > G.players[id].plasma ){
				G.UI.$grid.find(".vignette[creature='"+this+"']").addClass("notsummonable");
			}
		});


		G.players[id].creatures.each(function(){
			var $crea = G.UI.$grid.find(".vignette[creature='"+this.type+"']");
			$crea.removeClass("notsummonable");
			if(this.dead == true){
				$crea.addClass("dead");
			}else{
				$crea.addClass("queued");
			}
		});

		//Bind creature vignette click
		this.$grid.find(".vignette").unbind('click').bind("click",function(e){
			e.preventDefault();
			if(G.freezedInput) return;

			if($j(this).hasClass("locked")){
				G.UI.$dash.children("#tooltip").text("Creature locked.");
			}

			var creatureType = $j(this).attr("creature");
			G.UI.showCreature(creatureType,G.UI.selectedPlayer);
		});

	},

	showMusicPlayer: function(){
		this.$dash.addClass("active");

		this.showCreature(G.activeCreature.type,G.activeCreature.team);

		this.selectedPlayer = -1;
		
		this.$dash //Dash class
			.removeClass("selected0 selected1 selected2 selected3");

		$j("#tabwrapper").hide();
		$j("#musicplayerwrapper").show();
	},


	/*	toggleDash()
	*
	*	Show the dash and hide some buttons
	*
	*/
	toggleDash: function(){
		if(!this.$dash.hasClass("active")){
			this.showCreature(G.activeCreature.type,G.activeCreature.team);
		}else{
			this.closeDash();
		}

	},

	closeDash: function(materialize){
		this.$dash.removeClass("active");
		if(!materialize && G.activeCreature ){
			G.activeCreature.queryMove();
		}
		this.dashopen = false;
		this.materializeToggled = false;
	},


	/*	updateActiveBox()
	*
	*	Update activebox with new current creature's abilities
	*
	*/
	updateActivebox: function(){
		var $abilitiesButtons = $j("#abilities .ability");
		$abilitiesButtons.unbind("click");

		this.$activebox.find("#abilities").clearQueue().transition({y:"-420px"},function(){//Hide panel	
			$j(this).removeClass("p0 p1 p2 p3").addClass("p"+G.activeCreature.player.id);
			//Change abilities buttons
			G.UI.abilitiesButtons.each(function(){
				var ab = G.activeCreature.abilities[this.abilityId];
				this.css.normal = {"background-image":"url('../bestiary/"+G.activeCreature.name+"/"+this.abilityId+".svg')"};
				this.$button.next(".desc").find("span").text(ab.title);
				this.$button.next(".desc").find("p").html(ab.desc);

				var costs_string = ab.getFormatedCosts();
				var dmg_string = ab.getFormatedDamages();
				var special_string = ab.getFormatedEffects();

				//Removing elements
				this.$button.next(".desc").find(".costs , .damages , .special").remove();

				//Add if needed
				if(costs_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="costs"></div>');
					this.$button.next(".desc").find(".costs").html("Costs : "+costs_string);	
				}
				if(dmg_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="damages"></div>');
					this.$button.next(".desc").find(".damages").html("Damages : "+dmg_string);
				}
				if(special_string){
					this.$button.next(".desc").find(".abilityinfo_content").append('<div class="special"></div>');
					this.$button.next(".desc").find(".special").html("Effects : "+special_string);
				}

				this.click = function(){
					if(G.UI.selectedAbility!=this.abilityId){
						if(G.UI.dashopen) return false;
						G.grid.clearHexViewAlterations();
						//Activate Abilitie
						G.activeCreature.abilities[this.abilityId].use();
					}else{
						G.grid.clearHexViewAlterations();
						//Cancel Abilitie
						G.UI.closeDash();
						G.activeCreature.queryMove();
					}
				};
				this.changeState(); //ApplyChanges
			});
			G.UI.$activebox.children("#abilities").transition({y:"0px"}); //Show panel
		});

		if(G.activeCreature.player.creatures.length==1) //Blinking summon button during the 1st round
			this.abilitiesButtons[3].changeState("glowing");

		G.UI.checkAbilitiesTooltip();
		
		this.updateInfos();
	},

	checkAbilitiesTooltip : function(){
		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];

			var costs_string = ab.getFormatedCosts();
			var dmg_string = ab.getFormatedDamages();
			var special_string = ab.getFormatedEffects();

			//Removing elements
			this.abilitiesButtons[i].$button.next(".desc").find(".costs , .damages , .special").remove();

			//Add if needed
			if(costs_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="costs"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".costs").html("Costs : "+costs_string);	
			}
			if(dmg_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="damages"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".damages").html("Damages : "+dmg_string);
			}
			if(special_string){
				this.abilitiesButtons[i].$button.next(".desc").find(".abilityinfo_content").append('<div class="special"></div>');
				this.abilitiesButtons[i].$button.next(".desc").find(".special").html("Effects : "+special_string);
			}
		}
	},

	checkAbilities : function(){
		var oneUsableAbility = false;

		G.UI.checkAbilitiesTooltip();

		//Energy Bar
		var ratio = G.activeCreature.energy / G.activeCreature.stats.energy;
		G.UI.energyBar.setSize( ratio );

		for (var i = 0; i < 4; i++) {
			var ab = G.activeCreature.abilities[i];
			ab.message = "";
			var req = ab.require();
			ab.message = (ab.used) ? G.msg.abilities.alreadyused : ab.message;
			if( req && !ab.used && ab.trigger=="onQuery"){
				this.abilitiesButtons[i].changeState("glowing");
				oneUsableAbility = true;
			}else if( ab.message==G.msg.abilities.notarget || ( ab.trigger!="onQuery" && req && !ab.used ) ){
				this.abilitiesButtons[i].changeState("noclick");
			}else{
				this.abilitiesButtons[i].changeState("disabled");
			}

			//Charge
			this.abilitiesButtons[i].$button.next(".desc").find(".charge").remove();
			if( ab.getCharge != undefined ){
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="charge">Charge : '+ab.getCharge().value+"/"+ab.getCharge().max+'</div>')
			}

			//Message
			this.abilitiesButtons[i].$button.next(".desc").find(".message").remove();
			if( ab.message != "" ){
				this.abilitiesButtons[i].$button.next(".desc").append('<div class="message">'+ab.message+'</div>')
			}
		};

		if( !oneUsableAbility && G.activeCreature.remainingMove == 0 ){
			G.skipTurn({tooltip:"Finished"});
			//this.btnSkipTurn.changeState("glowing");
		}
	},

	/*	updateInfos()
	*	
	*/
	updateInfos:function(){
		$j("#playerbutton, #playerinfos")
			.removeClass("p0 p1 p2 p3")
			.addClass("p"+G.activeCreature.player.id);
		$j("#playerbutton").css("background-image","url('"+G.activeCreature.player.avatar+"')");
		$j("#playerinfos .name").text(G.activeCreature.player.name);
		$j("#playerinfos .points span").text(G.activeCreature.player.getScore().total);
		$j("#playerinfos .plasma span").text(G.activeCreature.player.plasma);
	},

	showStatInfos: function(stat){

		if( G.UI.selectedCreatureObj instanceof Creature ){
			var buffDebuff = G.UI.selectedCreatureObj.getBuffDebuff(stat);
			var atLeastOneBuff = false;
			$j(card).find("."+stat+" .stats_infos").html("");
			//Effects
			$j.each( buffDebuff.objs.effects, function(key,value){
				var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				$j(card).find("."+stat+" .stats_infos").append("<div>"+value.name+" : "+string+"</div>");
				atLeastOneBuff = true;
			});
			//Drops
			$j.each( buffDebuff.objs.drops, function(key,value){
				var string = G.UI.selectedCreatureObj.abilities[0].getFormatedDamages(value.alterations);
				$j(card).find("."+stat+" .stats_infos").append("<div>"+value.name+" : "+string+"</div>");
				atLeastOneBuff = true;
			});

			if(!atLeastOneBuff){
				$j(card).find("."+stat+" .stats_infos").html('<div class="textcenter">This stat doesn\'t have any modifiers</div>');
			}
		}

	},

	/*	updateTimer()
	*	
	*/
	updateTimer:function(){
		var date = new Date() - G.pauseTime;

		//TurnTimePool
		if( G.turnTimePool >= 0 ){
			var remainingTime = G.turnTimePool - Math.round((date - G.activeCreature.player.startTime)/1000);
			if(G.timePool > 0)
				remainingTime = Math.min(remainingTime, Math.round( (G.activeCreature.player.totalTimePool-(date - G.activeCreature.player.startTime))/1000) );
			var minutes = Math.floor(remainingTime/60);
			var seconds = remainingTime-minutes*60;
			var id = G.activeCreature.player.id;
			$j(".p"+id+" .turntime").text(zfill(minutes,2)+":"+zfill(seconds,2));
			//Time Alert
			if( remainingTime < G.turnTimePool*.25 ) 
				$j(".p"+id+" .turntime").addClass("alert");
			else
				$j(".p"+id+" .turntime").removeClass("alert");
			
			//Time Bar
			var timeRatio = ( (date - G.activeCreature.player.startTime) / 1000 ) / G.turnTimePool;
			G.UI.timeBar.setSize( 1 - timeRatio );
		}else{
			$j(".turntime").text("∞");
		}

		//TotalTimePool
		if( G.timePool >= 0 ){
			G.players.each(function(){
				var remainingTime = (this.id == G.activeCreature.player.id) ? this.totalTimePool - (date - this.startTime) : this.totalTimePool;
				remainingTime = Math.max(Math.round(remainingTime/1000),0);
				var minutes = Math.floor(remainingTime/60);
				var seconds = remainingTime-minutes*60;
				$j(".p"+this.id+" .timepool").text(zfill(minutes,2)+":"+zfill(seconds,2));
			});
		
			//Time Bar
			var poolRatio = ( G.activeCreature.player.totalTimePool - (date - G.activeCreature.player.startTime) ) / 1000 / G.timePool;
			G.UI.poolBar.setSize( poolRatio );
		}else{
			$j(".timepool").text("∞");
		}

	},


	/*	updateQueueDisplay()
	*	
	* 	Delete and add element to the Queue container based on the game's queues
	*
	*/
	updateQueueDisplay: function(){ //Ugly as hell need rewrite

		if(!G.nextQueue.length || !G.activeCreature ) return false; //Abort to avoid infinite loop

		var queueAnimSpeed = this.queueAnimSpeed;
		var transition = "linear";
		var nbrOfQueue = 2;

		//Set transition duration for stat indicators
		this.$queue.find('.vignette .stats').css({transition: "height "+queueAnimSpeed+"ms"});

		//Updating
		var $vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified",0);

		var deleteVignette = function(vignette){

			if( $j( vignette ).hasClass("roundmarker") ){
					$j( vignette ).attr("verified",-1).transition({x:-80, queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
			}else{
				if( $j( vignette ).hasClass("active") ){
					$j( vignette ).attr("verified",-1).transition({x:-100, queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
				}else{
					$j( vignette ).attr("verified",-1).transition({x:"-=80", queue: false },queueAnimSpeed,transition,function(){ this.remove(); });
				}
			}
			
			//Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var appendVignette = function(pos,vignette){

			//Create element
			if( $vignettes.length == 0 ){
				
				var $v = $j( vignette ).prependTo( G.UI.$queue );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 -80;
			
			}else if( $vignettes[pos] ){
			
				var $v = $j( vignette ).insertAfter( $vignettes[pos] );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 -80;
			
			}else{
			
				var $v = $j( vignette ).appendTo( G.UI.$queue );
				var index = $v.index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100 +1000;
			}

			//Animation
			$v.attr("verified",1)
				.css({x: offset})
				.transition({queue: true},queueAnimSpeed,transition); //Dont know why but it must be here

			//Updating
			$vignettes = G.UI.$queue.find('.vignette[verified!="-1"]');
		};

		var updatePos = function(){

			$vignettes.each(function(){
				var index = $j(this).index('#queuewrapper .vignette[verified!="-1"]');
				var offset = (index-(!!index))*80 + (!!index)*100;
				$j(this).css({"z-index": 0-index}).transition({x:offset, queue: false },queueAnimSpeed,transition);
			});
		};

		this.$queue.find('.vignette[verified!="-1"]').each(function(){
			if( $j(this).attr("turn") < G.turn ){
				deleteVignette( this );
			}	
		});

		//Prepend Current creature to queue after copying it
		var completeQueue = G.queue.slice(0);
		completeQueue.unshift(G.activeCreature);
		completeQueue = completeQueue.concat(G.delayQueue);

		for (var i = 1; i < nbrOfQueue; i++) {
			completeQueue = completeQueue.concat(["nextround"],G.nextQueue);	
		};

		var u = 0;
		
		//Updating
		$vignettes = this.$queue.find('.vignette[verified!="-1"]').attr("verified",0);

		for (var i = 0; i < completeQueue.length; i++) {

			//Round Marker
			if( typeof completeQueue[i] == "string" ){

				var queueElem = '<div turn="'+(G.turn+u)+'" roundmarker="1" class="vignette roundmarker"><div class="frame"></div><div class="stats">Round '+(G.turn+1)+'</div></div>';

				//If this element does not exists
				if( $vignettes[i] == undefined ){
					//Create it
					appendVignette(i,queueElem);
				}else{
					//While its not the round marker
					while( $j( $vignettes[i] ).attr("roundmarker") == undefined ){
						deleteVignette( $vignettes[i] );
					}
				}
				u++;

			//Creature Vignette
			}else{

				var initiative =  completeQueue[i].getInitiative( (u==0) );
				var queueElem = '<div turn="'+(G.turn+u)+'" creatureid="'+completeQueue[i].id+'" initiative="'+initiative+'" class="vignette hidden p'+completeQueue[i].team+" type"+completeQueue[i].type+'"><div class="frame"></div><div class="stats"></div></div>';

				//If this element does not exists
				if( $vignettes[i] == undefined ){
					//Create it
					appendVignette(i,queueElem);
				}else{
					//While it'ss not the right creature
					while( $j($vignettes[i]).attr("creatureid") != completeQueue[i].id ){

						if( $j($vignettes[i]).attr("creatureid") == undefined ){ //Is Round Marker
							//Create element before
							appendVignette(i-1,queueElem);
						}else if( $j($vignettes[i]).attr("initiative") < initiative ){ //Initiative is lower
							//Create element before
							appendVignette(i-1,queueElem);
						}else{
							//Remove element
							deleteVignette( $vignettes[i] );
						}
					}
				}
			}

			//Tag as verified
			$j($vignettes[i]).attr("verified",1);
		};

		//Delete non verified
		deleteVignette( this.$queue.find('.vignette[verified="0"]') );

		updatePos();

		this.updateFatigue();

		//Set active creature
		this.$queue.find('.vignette.active').removeClass("active"); //Avoid bugs
		this.$queue.find('.vignette[verified="1"]')
			.first().clearQueue().addClass("active")
			.css({ transformOrigin: '0px 0px' })
			.transition({ scale : 1.25, x : 0 },queueAnimSpeed,transition);

		//Add mouseover effect
		
		this.$queue.find('.vignette.roundmarker').unbind("mouseover").unbind("mouseleave").bind("mouseover",function(){
			G.grid.showGrid(true);
		}).bind("mouseleave",function(){
			G.grid.showGrid(false);
		});

		this.$queue.find('.vignette').not(".roundmarker").unbind("mouseover").unbind("mouseleave").bind("mouseover",function(){
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.grid.showMovementRange(creaID);
			G.creatures.each(function(){
				if(this instanceof Creature){
					this.$display.removeClass("ghosted");
					this.$health.removeClass("ghosted");
					if(this.id != creaID){ this.$display.addClass("ghosted"); this.$health.addClass("ghosted"); };
				}
			});
			G.UI.xrayQueue(creaID);
		}).bind("mouseleave",function(){ //On mouseleave cancel effect
			if(G.freezedInput) return;
			G.grid.redoLastQuery();
			G.creatures.each(function(){
				if(this instanceof Creature){
					this.$display.removeClass("ghosted");
				}
			});
			G.UI.xrayQueue(-1);
		}).bind("click",function(){ //Show dash on click
			if(G.freezedInput) return;
			var creaID = $j(this).attr("creatureid")-0;
			G.UI.showCreature(G.creatures[creaID].type,G.creatures[creaID].team);
		});

	},

	xrayQueue : function(creaID){
		this.$queue.find('.vignette').removeClass("xray");
		if(creaID>0) this.$queue.find('.vignette[creatureid="'+creaID+'"]').addClass("xray");
	},

	updateFatigue : function(){

		G.creatures.each(function(){
			if(this instanceof Creature){
				var text = (this.endurance > 0) ? this.endurance + "/" + this.stats.endurance : "Fatigued";

				if(this.type == "--"){ //If Dark Priest
					this.abilities[0].require(); //Update protectedFromFratigue
				}

				text = ( this.protectedFromFratigue || this.stats.fatigueImunity ) ? "Protected" : text;
				text = ( this.materializeSickness ) ? "Sickened" : text;
				$j('#queuewrapper .vignette[creatureid="'+this.id+'"]').children(".stats").text(text);
			}
		});
		
	}

});

var Chat = Class.create({
	/*	Constructor
	*	
	* 	Chat/Log Functions
	*
	*/
	initialize: function(){
		this.$chat = $j("#chat");
		this.$content = $j("#chatcontent");
		this.$chat.bind('click',function(){G.UI.chat.toggle();});
		$j("#combatwrapper,#toppanel,#dash,#endscreen").bind('click',function(){G.UI.chat.hide();});
	},


	show : function(){ this.$chat.addClass("focus"); },
	hide : function(){ this.$chat.removeClass("focus"); },
	toggle : function(){ this.$chat.toggleClass("focus"); this.$content.parent().scrollTop(this.$content.height());},

	addMsg : function(msg,htmlclass){
		var time = new Date(new Date() - G.startMatchTime);
		this.$content.append("<p class='"+htmlclass+"'><i>"+zfill(time.getUTCHours(),2)+":"+zfill(time.getMinutes(),2)+":"+zfill(time.getSeconds(),2)+"</i> "+msg+"</p>");
		this.$content.parent().scrollTop(this.$content.height());
	},
});


var Button = Class.create({
	/*	Constructor
	*	
	* 	Create attributes and default buttons
	*
	*/
	initialize: function(opts){

		defaultOpts = {
			click : function(){},
			mouseover : function(){},
			mouseleave : function(){},
			clickable : true,
			state : "normal", // disabled,normal,glowing,selected,active
			$button : undefined,
			attributes : {},
			css : {
				disabled  	: {},
				glowing  	: {},
				selected  	: {},
				active 		: {},
				normal 		: {},
			}
		};

		opts = $j.extend(defaultOpts,opts);
		$j.extend(this,opts);
		this.changeState(this.state);
	},


	changeState : function(state){
		var btn = this;

		if(!state) state = this.state;
		this.state = state;
		this.$button.unbind("click").unbind("mouseover").unbind("mouseleave");
		if( state != "disabled" ){
			this.$button.bind("click",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.click();
			} );
			this.$button.bind("mouseover",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseover();
			} );
			this.$button.bind("mouseleave",function(){
				if(G.freezedInput || !btn.clickable) return;
				btn.mouseleave();
			} );
		}
		this.$button.removeClass("disabled glowing selected active noclick")
		this.$button.css( this.css["normal"] );
		if( state != "normal" ){
			this.$button.addClass(state);
			this.$button.css( this.css[state] );
		}
	},

	triggerClick : function(){
		if(G.freezedInput || !this.clickable) return;
		this.click();
	},

	triggerMouseover : function(){
		if(G.freezedInput || !this.clickable) return;
		this.mouseover();
	},

	triggerMouseleave : function(){
		if(G.freezedInput || !this.clickable) return;
		this.mouseleave();
	},
});

var ProgessBar = Class.create({

	initialize: function(opts){
		defaultOpts = {
			height : 318,
			width : 18,
			color : "red",
			$bar : undefined
		};

		opts = $j.extend(defaultOpts,opts);
		$j.extend(this,opts);

		this.setSize(0);
	},

	/*	setSize
	*	
	* 	percentage : 	Float : 	size between 0 and 1
	*
	*/
	setSize: function(percentage){
		this.$bar.css({
			width : this.width,
			height : this.height*percentage,
			"background-color" : this.color,
		});
	}
});