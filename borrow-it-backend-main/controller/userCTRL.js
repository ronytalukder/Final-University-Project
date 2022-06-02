const User = require("../model/userModel");
const Product = require("../model/productModel");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
var nodemailer = require("nodemailer");
const hbs = require("nodemailer-express-handlebars");
const path = require("path");

const userCTRL = {
  register: async (req, res) => {
    try {
      const { name, email, password, rePassword } = req.body;
      const token = Math.floor(1000 + Math.random() * 9000);

      if (!name || !email || !password || !rePassword) {
        return res.status(400).json({ msg: "Invalid Creadentials." });
      }

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ msg: "This User Already Exists." });
      }
      if (password.length < 4) {
        return res
          .status(400)
          .json({ msg: "Password must be 4 lengths long." });
      }
      if (password !== rePassword) {
        return res.status(400).json({ msg: "Password Doesn't Match." });
      }
      const hashPass = await bcrypt.hash(password, 10);
      const newUser = new User({
        name,
        email,
        password: hashPass,
      });

      await newUser.save();

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "ronysextrawork@gmail.com",
          pass: "uodaproject",
        },
      });

      // point to the template folder
      const handlebarOptions = {
        viewEngine: {
          partialsDir: path.resolve("./views/"),
          defaultLayout: false,
        },
        viewPath: path.resolve("./views/"),
      };

      // use a template file with nodemailer
      transporter.use("compile", hbs(handlebarOptions));

      var mailOptions = {
        from: '"Borrow it" <rashedkhan1219bd@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Your reset password token!",
        template: "email", // the name of the template file i.e email.handlebars
        context: {
          token: token, // replace {{company}} with My Company
        },
      };

      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          console.log(error);
        } else {
          await User.findOneAndUpdate(
            { email: email },
            {
              passwordResetToken: token,
            }
          );
          res.json({ msg: "Token Sent" });
        }
      });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  refreshToken: async (req, res) => {
    const rf_token = req.cookies.refreshToken;
    if (!rf_token) {
      return res.status(400).json({ msg: "Please Login or Register." });
    }
    jwt.verify(rf_token, process.env.REFRESH_TOKEN_SECRET, (err, admin) => {
      if (err) {
        return res.status(400).json({ msg: "Please Login or Register." });
      }
      const accessToken = createAccessToken({ id: admin.id });

      res.json({ accessToken });
    });
  },
  login: async (req, res) => {
    try {
      const { email, password } = req.body;
      const token = Math.floor(1000 + Math.random() * 9000);
      if (!email || !password) {
        return res.status(400).json({ msg: "Invalid Creadential." });
      }
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ msg: "User Doesn't Exists." });
      }
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Incorrect Password." });
      }

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "ronysextrawork@gmail.com",
          pass: "uodaproject",
        },
      });

      // point to the template folder
      const handlebarOptions = {
        viewEngine: {
          partialsDir: path.resolve("./views/"),
          defaultLayout: false,
        },
        viewPath: path.resolve("./views/"),
      };

      // use a template file with nodemailer
      transporter.use("compile", hbs(handlebarOptions));

      var mailOptions = {
        from: '"Borrow it" <rashedkhan1219bd@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Your reset password token!",
        template: "email", // the name of the template file i.e email.handlebars
        context: {
          token: token, // replace {{company}} with My Company
        },
      };

      if (user.status === false) {
        return transporter.sendMail(mailOptions, async (error, info) => {
          if (!error) {
            await User.findOneAndUpdate(
              { email: email },
              {
                passwordResetToken: token,
              }
            );
            return res.status(402).json({ msg: "Token Sent" });
          }
        });
      }
      // else {
      //   return res.status(402).json({ msg: "Account not active" });
      // }

      const accessToken = createAccessToken({ id: user._id });
      const refreshToken = createRefreshToken({ id: user._id });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.json({ accessToken });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  logout: async (req, res) => {
    try {
      res.clearCookie("refreshToken", {
        httpOnly: true,
        expires: new Date(0),
        // secure: true,
        // sameSite: "none",
      });
      return res.json({ msg: "Logged Out" });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  getUser: async (req, res) => {
    try {
      const user = await User.findById(req.user.id).select("-password");
      if (!user) {
        return res.status(400).json({ msg: "User Doesn't Exists." });
      }
      res.json(user);
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  productList: async (req, res) => {
    try {
      const products = await Product.find({ user: req.user.id });
      res.json(products);
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  updatePassword: async (req, res) => {
    try {
      const { currentPassword, newPassword, confirmPassword } = req.body;
      if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({ msg: "Invalid Credentials" });
      }
      const user = await User.findOne({ _id: req.user.id });
      if (!user) {
        return res.status(400).json({ msg: "User not Found" });
      }
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ msg: "Current Password not Matched" });
      }
      if (newPassword.length < 4) {
        return res.status(400).json({ msg: "Password must be 4 Lengths Long" });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ msg: "Password Doesn't Match" });
      }
      const hashPass = await bcrypt.hash(newPassword, 10);
      await User.findOneAndUpdate(
        { _id: req.user.id },
        {
          password: hashPass,
        }
      );
      res.json({ msg: "Password Changed." });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  generateToken: async (req, res) => {
    try {
      const { email } = req.body;
      const token = Math.floor(1000 + Math.random() * 9000);
      if (!email) {
        return res.status(400).json({ msg: "Invalid Credentials" });
      }
      const user = await User.findOne({ email: email });
      if (!user) {
        return res.status(400).json({ msg: "User not Found" });
      }

      var transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "ronysextrawork@gmail.com",
          pass: "uodaproject",
        },
      });

      // point to the template folder
      const handlebarOptions = {
        viewEngine: {
          partialsDir: path.resolve("./views/"),
          defaultLayout: false,
        },
        viewPath: path.resolve("./views/"),
      };

      // use a template file with nodemailer
      transporter.use("compile", hbs(handlebarOptions));

      var mailOptions = {
        from: '"Borrow it" <rashedkhan1219bd@gmail.com>', // sender address
        to: email, // list of receivers
        subject: "Your reset password token!",
        template: "email", // the name of the template file i.e email.handlebars
        context: {
          token: token, // replace {{company}} with My Company
        },
      };

      transporter.sendMail(mailOptions, async (error, info) => {
        if (error) {
          console.log(error);
        } else {
          await User.findOneAndUpdate(
            { email: email },
            {
              passwordResetToken: token,
            }
          );
          res.json({ msg: "Token Sent" });
        }
      });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  forgotPassword: async (req, res) => {
    try {
      const { email, newPassword, confirmPassword } = req.body;
      if (!email || !newPassword || !confirmPassword) {
        return res.status(400).json({ msg: "Invalid Credentials" });
      }
      const user = await User.findOne({ email: email });
      if (!user) {
        return res.status(400).json({ msg: "User not Found" });
      }
      if (newPassword.length < 4) {
        return res.status(400).json({ msg: "Password must be 4 Lengths Long" });
      }
      if (newPassword !== confirmPassword) {
        return res.status(400).json({ msg: "Password Doesn't Match" });
      }
      const hashPass = await bcrypt.hash(newPassword, 10);
      await User.findOneAndUpdate(
        { email: email },
        {
          password: hashPass,
        }
      );
      res.json({ msg: "Password Changed." });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  accountActive: async (req, res) => {
    try {
      const { email, token } = req.body;
      if (!email || !token) {
        return res.status(400).json({ msg: "Invalid Credentials" });
      }
      const user = await User.findOne({ email: email });
      if (!user) {
        return res.status(400).json({ msg: "User not Found" });
      }
      if (token !== user?.passwordResetToken) {
        return res.status(400).json({ msg: "Token not matched" });
      }
      await User.findOneAndUpdate(
        { email: email },
        {
          status: true,
        }
      );
      const accessToken = createAccessToken({ id: user._id });
      const refreshToken = createRefreshToken({ id: user._id });

      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
      });

      res.json({ accessToken });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
  verifyToken: async (req, res) => {
    try {
      const { token, email } = req.body;
      if (!token) {
        return res.status(400).json({ msg: "Invalid Token" });
      }
      const user = await User.findOne({ email: email });
      if (token !== user.passwordResetToken) {
        return res.status(400).json({ msg: "Token not Matched" });
      }
      res.json({ msg: "Matched" });
    } catch (error) {
      return res.status(500).json({ msg: error.message });
    }
  },
};

const createAccessToken = (user) => {
  return jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: "1d",
  });
};

const createRefreshToken = (user) => {
  return jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: "7d",
  });
};

module.exports = userCTRL;
