var q = require('q');
var _ = require('lodash');
var storage;
var userNameCache = {};

module.exports = {
  init: init
};

function init(controller, connectedBot) {
  storage = require('botkit-promise-storage')(controller);

  populateCache(connectedBot);

  controller.hears('^(.*)\\+\\+$', 'ambient', function(bot, message) {
    var usernameOrId = message.match[1];

    getUser(bot, usernameOrId)
      .then(function(user) {
        if (user.id === message.user) {
          return bot.reply(message, 'tsk tsk tsk, you can\'t give karma to yourself :smirk_cat:');
        }

        user.karma++;
        return storage.users.save(user)
          .then(function() {
            if (user.karma % 100 === 0) {
              var emoji = _.padStart('', ':100:'.length * (user.karma / 100), ':100:');

              return bot.reply(message, 'Woohoo! <@' + user.id + '> has ' + user.karma + ' karma! ' + emoji);
            }

            bot.reply(message, '<@' + user.id + '> has ' + user.karma + ' karma');
          });
      })
      .catch(function(err) {
        controller.log(err);
        bot.reply(message, 'Sorry, I\'m not sure who ' + usernameOrId + ' is :frown:');
      });
  });

  controller.hears('^karma (.*)', 'direct_message,direct_mention', function(bot, message) {
    var usernameOrId = message.match[1];

    getUser(bot, usernameOrId, false)
      .then(function(user) {
        bot.reply(message, '<@' + user.id + '> has ' + user.karma + ' karma');
      })
      .catch(function(err) {
        controller.log(err);
        bot.reply(message, 'Sorry, I\'m not sure who ' + usernameOrId + ' is :frown:');
      });
  });
}

function getUser(bot, userNameOrId) {
  return getUserId(bot, userNameOrId)
    .then(function(userId) {
      return storage.users.get(userId)
        .then(function(user) {
          if (!user) {
            user = {id: userId};
          }

          if (!user.karma) {
            user.karma = 0;
          }

          return user;
        });
    });
}

/**
 * Given either a Slack identified user string, e.g., <@UABC123>, or a bare user name, e.g., johnstamos,
 *
 */
function getUserId(bot, user) {
  if (/^<@U[A-Z0-9]*>$/.test(user)) {
    return q(user.replace('<@', '').replace('>', ''));
  }

  if (userNameCache[user]) {
    return q(userNameCache[user]);
  }

  return populateCache(bot)
    .then(function() {
      var userId = userNameCache[user];

      if (!userId) {
        throw new Error('user ' + user + ' not found');
      }

      return userId;
    });
}

/**
 * Populates the userNameCache
 * @param bot
 */
function populateCache(bot) {
  var usersList = q.nbind(bot.api.users.list, bot.api.users);

  return usersList({presence: 0})
    .then(function(data) {
      if (!data.ok) {
        throw new Error(data.error);
      }

      userNameCache = {};

      data.members.forEach(function(user) {
        userNameCache[user.name] = user.id;
      });

      return userNameCache;
    });
}
